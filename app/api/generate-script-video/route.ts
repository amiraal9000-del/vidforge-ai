import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://vidforgeai.com.ng";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const MODEL = "google/veo-3.1-lite";
const BUCKET = "input-images";

const PRICING: Record<number, { audio: number; silent: number }> = {
  4: { audio: 40, silent: 25 },
  6: { audio: 60, silent: 40 },
  8: { audio: 80, silent: 50 },
};

type ParsedDialogue = {
  spokenText: string;
  hasUnmatchedQuote: boolean;
};

type VideoRow = {
  id: string;
  user_id: string;
  prompt: string | null;
  image_url: string | null;
  video_url: string | null;
  duration: number | null;
  cost: number | null;
  has_audio?: boolean | null;
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[VidForge] Missing Supabase environment variables");
}

const supabaseAdmin = createClient(
  SUPABASE_URL || "",
  SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function jsonError(message: string, status = 500, extra?: unknown) {
  console.error("[VidForge]", message, extra ?? "");
  return NextResponse.json(
    {
      error: message,
      details:
        extra instanceof Error
          ? extra.message
          : typeof extra === "string"
            ? extra
            : undefined,
    },
    { status }
  );
}

function extractQuotedDialogue(text: string): ParsedDialogue {
  const segments: string[] = [];

  let straightOpen = false;
  let curlyOpen = false;

  let currentStraight = "";
  let currentCurly = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (straightOpen) {
        if (currentStraight.trim()) {
          segments.push(currentStraight.trim());
        }

        currentStraight = "";
        straightOpen = false;
      } else {
        straightOpen = true;
        currentStraight = "";
      }

      continue;
    }

    if (char === "“") {
      if (!curlyOpen) {
        curlyOpen = true;
        currentCurly = "";
      }

      continue;
    }

    if (char === "”") {
      if (curlyOpen) {
        if (currentCurly.trim()) {
          segments.push(currentCurly.trim());
        }

        currentCurly = "";
        curlyOpen = false;
      }

      continue;
    }

    if (straightOpen) {
      currentStraight += char;
    }

    if (curlyOpen) {
      currentCurly += char;
    }
  }

  return {
    spokenText: segments.join(" ").trim(),
    hasUnmatchedQuote: straightOpen || curlyOpen,
  };
}

function buildVeoPrompt(
  script: string,
  spokenText: string,
  hasAudio: boolean
): string {
  if (!hasAudio) {
    return `
Create the video described below.

VISUAL / PERFORMANCE DIRECTION:
${script}

Do not add spoken dialogue unless the visual direction explicitly requires it.
Use natural realistic motion, facial expressions, camera movement and cinematic presentation.
`.trim();
  }

  return `
Create a realistic cinematic video from the provided reference image.

IMPORTANT DIALOGUE RULE:
Words outside quotation marks are VISUAL / PERFORMANCE INSTRUCTIONS.
Only the text inside quotation marks is SPOKEN DIALOGUE.

Do NOT read the visual instructions aloud.
Do NOT invent additional dialogue.
Do NOT paraphrase the dialogue.

VISUAL / PERFORMANCE DIRECTION:
${script}

EXTRACTED SPOKEN DIALOGUE:
"${spokenText}"

The person should naturally speak the extracted dialogue with accurate lip synchronization, realistic facial movement, natural expression and subtle gestures.
`.trim();
}

async function getUserFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    console.error("[VidForge] Auth error:", error);
    return null;
  }

  return data.user;
}

async function getProfileCredits(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not read credits: ${error.message}`);
  }

  return Number(data?.credits ?? 0);
}

async function changeCredits(
  userId: string,
  amount: number
): Promise<number> {
  const current = await getProfileCredits(userId);
  const next = current + amount;

  if (next < 0) {
    throw new Error("Insufficient credits.");
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ credits: next })
    .eq("id", userId);

  if (error) {
    throw new Error(`Could not update credits: ${error.message}`);
  }

  return next;
}

async function refundCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<number | null> {
  try {
    console.log(
      `[VidForge] REFUND ${amount} credits to ${userId}. Reason: ${reason}`
    );

    return await changeCredits(userId, amount);
  } catch (error) {
    console.error("[VidForge] Refund failed:", error);
    return null;
  }
}

async function uploadInputImage(
  userId: string,
  image: File
): Promise<{
  path: string;
  publicUrl: string;
  signedUrl: string;
}> {
  const extension =
    image.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "jpg";

  const safeExtension =
    extension === "png" || extension === "webp" ? extension : "jpg";

  const path = `generated-inputs/${userId}/${crypto.randomUUID()}.${safeExtension}`;

  const buffer = Buffer.from(await image.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: image.type || "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const { data: publicData } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  const publicUrl = publicData.publicUrl;

  const { data: signedData, error: signedError } =
    await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Could not create image URL for OpenRouter: ${
        signedError?.message || "No signed URL returned"
      }`
    );
  }

  console.log("[VidForge] Input image uploaded:", {
    path,
    publicUrl,
    signedUrlCreated: true,
  });

  return {
    path,
    publicUrl,
    signedUrl: signedData.signedUrl,
  };
}

async function createVideoRecord(params: {
  userId: string;
  prompt: string;
  imageUrl: string;
  duration: number;
  cost: number;
  hasAudio: boolean;
}) {
  const { data, error } = await supabaseAdmin
    .from("user_videos")
    .insert({
      user_id: params.userId,
      prompt: params.prompt,
      image_url: params.imageUrl,
      video_url: "pending:submitting",
      duration: params.duration,
      cost: params.cost,
      has_audio: params.hasAudio,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(
      `Could not create video record: ${error?.message || "No row returned"}`
    );
  }

  return data as VideoRow;
}

async function markVideoPendingJob(
  recordId: string,
  jobId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_videos")
    .update({
      video_url: `pending:${jobId}`,
    })
    .eq("id", recordId);

  if (error) {
    console.error(
      "[VidForge] Could not attach OpenRouter job to database:",
      error
    );
  }
}

async function markVideoFailed(
  recordId: string,
  message: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_videos")
    .update({
      video_url: `failed:${message.slice(0, 500)}`,
    })
    .eq("id", recordId);

  if (error) {
    console.error("[VidForge] Could not mark video failed:", error);
  }
}

async function getVideoRecordByJob(
  userId: string,
  jobId: string
): Promise<VideoRow | null> {
  const { data, error } = await supabaseAdmin
    .from("user_videos")
    .select("*")
    .eq("user_id", userId)
    .eq("video_url", `pending:${jobId}`)
    .maybeSingle();

  if (error) {
    console.error("[VidForge] Could not find job record:", error);
    return null;
  }

  return data as VideoRow | null;
}

async function saveGeneratedVideo(params: {
  userId: string;
  jobId: string;
  videoBuffer: Buffer;
}): Promise<string> {
  const path = `generated-videos/${params.userId}/${params.jobId}.mp4`;

  console.log("[VidForge] Saving generated MP4:", {
    path,
    bytes: params.videoBuffer.length,
  });

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, params.videoBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    throw new Error(`Generated video upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage
    .from(BUCKET)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Supabase did not return a public video URL.");
  }

  console.log("[VidForge] Generated MP4 saved:", data.publicUrl);

  return data.publicUrl;
}

async function downloadOpenRouterVideo(
  jobId: string,
  unsignedUrl?: string
): Promise<Buffer> {
  /*
   * IMPORTANT:
   * OpenRouter's current video API returns an unsigned_urls entry
   * pointing at its authenticated content endpoint.
   *
   * We deliberately send the OpenRouter API key here.
   */

  const downloadUrl =
    unsignedUrl ||
    `${OPENROUTER_BASE}/videos/${encodeURIComponent(
      jobId
    )}/content?index=0`;

  console.log("[VidForge] Downloading completed video:", {
    jobId,
    downloadUrl,
  });

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") || "";

  console.log("[VidForge] OpenRouter video download response:", {
    jobId,
    status: response.status,
    ok: response.ok,
    contentType,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `OpenRouter video download failed (${response.status}): ${body.slice(
        0,
        1000
      )}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error("OpenRouter returned an empty video file.");
  }

  if (
    !contentType.toLowerCase().includes("video") &&
    !contentType.toLowerCase().includes("octet-stream")
  ) {
    console.warn(
      "[VidForge] Unexpected OpenRouter video content type:",
      contentType
    );
  }

  console.log("[VidForge] MP4 downloaded successfully:", {
    jobId,
    bytes: buffer.length,
    contentType,
  });

  return buffer;
}

async function getOpenRouterJob(jobId: string) {
  const response = await fetch(
    `${OPENROUTER_BASE}/videos/${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      cache: "no-store",
    }
  );

  const raw = await response.text();

  let data: any;

  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `OpenRouter polling returned non-JSON (${response.status}): ${raw.slice(
        0,
        1000
      )}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `OpenRouter polling failed (${response.status}): ${JSON.stringify(
        data
      ).slice(0, 1500)}`
    );
  }

  return data;
}

export async function POST(request: NextRequest) {
  let recordId: string | null = null;
  let userId: string | null = null;
  let cost = 0;

  try {
    console.log("[VidForge] ===== VIDEO GENERATION START =====");

    if (!OPENROUTER_API_KEY) {
      return jsonError("OPENROUTER_API_KEY is missing on the server.", 500);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonError(
        "Supabase server configuration is missing.",
        500
      );
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized.", 401);
    }

    userId = user.id;

    const formData = await request.formData();

    const prompt = String(formData.get("prompt") || "").trim();
    const suppliedSpokenText = String(
      formData.get("spokenText") || ""
    ).trim();

    const image = formData.get("image");
    const duration = Number(formData.get("duration") || 0);
    const withAudio =
      String(formData.get("withAudio") || "false") === "true";

    if (!prompt) {
      return jsonError("Please enter a script.", 400);
    }

    if (!(image instanceof File)) {
      return jsonError("Please upload an image.", 400);
    }

    if (!PRICING[duration]) {
      return jsonError("Duration must be 4, 6, or 8 seconds.", 400);
    }

    if (image.size <= 0) {
      return jsonError("The uploaded image is empty.", 400);
    }

    if (image.size > 10 * 1024 * 1024) {
      return jsonError("Image must be 10MB or smaller.", 400);
    }

    const parsed = extractQuotedDialogue(prompt);

    const spokenText =
      suppliedSpokenText || parsed.spokenText;

    if (withAudio && parsed.hasUnmatchedQuote) {
      return jsonError(
        "Your spoken dialogue has an unmatched quotation mark. Please close the quote around the words you want spoken.",
        400
      );
    }

    if (withAudio && !spokenText) {
      return jsonError(
        'For AI audio, put the words you want spoken inside quotation marks. Example: She says, "Hello from VidForge AI."',
        400
      );
    }

    cost = withAudio
      ? PRICING[duration].audio
      : PRICING[duration].silent;

    const currentCredits = await getProfileCredits(userId);

    if (currentCredits < cost) {
      return jsonError(
        `Not enough credits. You need ${cost} credits but have ${currentCredits}.`,
        400
      );
    }

    console.log("[VidForge] Request:", {
      userId,
      duration,
      withAudio,
      cost,
      promptLength: prompt.length,
      spokenText,
      imageName: image.name,
      imageSize: image.size,
      model: MODEL,
    });

    const uploaded = await uploadInputImage(userId, image);

    const videoRecord = await createVideoRecord({
      userId,
      prompt,
      imageUrl: uploaded.publicUrl,
      duration,
      cost,
      hasAudio: withAudio,
    });

    recordId = videoRecord.id;

    /*
     * IMPORTANT:
     * We deduct credits immediately before submitting the provider job.
     * If submission fails, we refund them.
     */
    const remainingCredits = await changeCredits(userId, -cost);

    const veoPrompt = buildVeoPrompt(
      prompt,
      spokenText,
      withAudio
    );

    const openRouterPayload = {
      model: MODEL,
      prompt: veoPrompt,
      duration,
      aspect_ratio: "9:16",
      resolution: "720p",
      generate_audio: withAudio,
      frame_images: [
        {
          type: "image_url",
          image_url: {
            url: uploaded.signedUrl,
          },
          frame_type: "first_frame",
        },
      ],
    };

    console.log(
      "[VidForge] Sending generation request to OpenRouter:",
      JSON.stringify({
        ...openRouterPayload,
        frame_images: [
          {
            type: "image_url",
            image_url: {
              url: "[SIGNED IMAGE URL]",
            },
            frame_type: "first_frame",
          },
        ],
      })
    );

    const submitResponse = await fetch(
      `${OPENROUTER_BASE}/videos`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": SITE_URL,
          "X-Title": "VidForge AI",
        },
        body: JSON.stringify(openRouterPayload),
        cache: "no-store",
      }
    );

    const submitRaw = await submitResponse.text();

    let submitData: any;

    try {
      submitData = JSON.parse(submitRaw);
    } catch {
      submitData = {
        raw: submitRaw,
      };
    }

    console.log("[VidForge] OpenRouter submission response:", {
      status: submitResponse.status,
      ok: submitResponse.ok,
      data: submitData,
    });

    if (!submitResponse.ok) {
      if (recordId) {
        await markVideoFailed(
          recordId,
          `OpenRouter submission failed: ${JSON.stringify(
            submitData
          )}`
        );
      }

      await refundCredits(
        userId,
        cost,
        "OpenRouter submission rejected"
      );

      return NextResponse.json(
        {
          error:
            submitData?.error ||
            submitData?.message ||
            "OpenRouter rejected the video request.",
          details: submitData,
        },
        { status: submitResponse.status }
      );
    }

    const jobId = String(submitData?.id || "").trim();

    if (!jobId) {
      if (recordId) {
        await markVideoFailed(
          recordId,
          "OpenRouter accepted request but returned no job ID."
        );
      }

      await refundCredits(
        userId,
        cost,
        "OpenRouter returned no job ID"
      );

      return jsonError(
        "OpenRouter accepted the request but returned no video job ID.",
        502
      );
    }

    if (recordId) {
      await markVideoPendingJob(recordId, jobId);
    }

    console.log("[VidForge] OpenRouter JOB CREATED:", {
      jobId,
      status: submitData?.status,
      pollingUrl: submitData?.polling_url,
    });

    return NextResponse.json({
      success: true,
      jobId,
      status: submitData?.status || "pending",
      remainingCredits,
    });
  } catch (error) {
    console.error("[VidForge] POST fatal error:", error);

    if (recordId) {
      await markVideoFailed(
        recordId,
        error instanceof Error
          ? error.message
          : "Unknown generation error"
      );
    }

    if (userId && cost > 0) {
      await refundCredits(
        userId,
        cost,
        "Unexpected error before video job was established"
      );
    }

    return jsonError(
      error instanceof Error
        ? error.message
        : "Video generation failed.",
      500
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[VidForge] ===== VIDEO STATUS CHECK =====");

    if (!OPENROUTER_API_KEY) {
      return jsonError("OPENROUTER_API_KEY is missing.", 500);
    }

    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("Unauthorized.", 401);
    }

    const { searchParams } = new URL(request.url);
    const jobId = String(searchParams.get("jobId") || "").trim();

    if (!jobId) {
      return jsonError("Missing jobId.", 400);
    }

    const record = await getVideoRecordByJob(
      user.id,
      jobId
    );

    if (!record) {
      return jsonError(
        "Video generation job was not found.",
        404
      );
    }

    const job = await getOpenRouterJob(jobId);

    const status = String(job?.status || "").toLowerCase();

    console.log("[VidForge] OpenRouter job status:", {
      jobId,
      status,
      generationId: job?.generation_id,
      error: job?.error,
    });

    if (
      status === "pending" ||
      status === "in_progress"
    ) {
      return NextResponse.json({
        status,
        jobId,
        remainingCredits: await getProfileCredits(user.id),
      });
    }

    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "expired"
    ) {
      const providerError =
        typeof job?.error === "string"
          ? job.error
          : JSON.stringify(job?.error || "Unknown provider error");

      await markVideoFailed(
        record.id,
        `OpenRouter ${status}: ${providerError}`
      );

      const remainingCredits = await refundCredits(
        user.id,
        Number(record.cost || 0),
        `OpenRouter job ${status}`
      );

      return NextResponse.json({
        status: "failed",
        jobId,
        error: providerError,
        remainingCredits,
      });
    }

    if (status !== "completed") {
      return NextResponse.json({
        status: status || "pending",
        jobId,
        remainingCredits: await getProfileCredits(user.id),
      });
    }

    console.log("[VidForge] JOB COMPLETED. Retrieving MP4.", {
      jobId,
      unsignedUrls: job?.unsigned_urls,
    });

    const unsignedUrl =
      Array.isArray(job?.unsigned_urls) &&
      job.unsigned_urls.length > 0
        ? job.unsigned_urls[0]
        : undefined;

    /*
     * THIS IS THE CRITICAL FIX:
     *
     * Do not return OpenRouter's content URL to the browser.
     * The server downloads the actual MP4 using the OpenRouter API key,
     * then saves the MP4 into Supabase.
     */
    const videoBuffer = await downloadOpenRouterVideo(
      jobId,
      unsignedUrl
    );

    const savedVideoUrl = await saveGeneratedVideo({
      userId: user.id,
      jobId,
      videoBuffer,
    });

    const { error: updateError } = await supabaseAdmin
      .from("user_videos")
      .update({
        video_url: savedVideoUrl,
      })
      .eq("id", record.id);

    if (updateError) {
      /*
       * IMPORTANT:
       * The MP4 already exists in Supabase.
       * Therefore DO NOT refund the user here.
       */
      console.error(
        "[VidForge] MP4 saved but DB update failed:",
        updateError
      );

      return NextResponse.json({
        status: "completed",
        jobId,
        videoUrl: savedVideoUrl,
        remainingCredits: await getProfileCredits(user.id),
        warning:
          "Video was generated and saved, but the history database update failed.",
      });
    }

    const remainingCredits = await getProfileCredits(
      user.id
    );

    console.log("[VidForge] ===== VIDEO COMPLETE =====", {
      jobId,
      videoUrl: savedVideoUrl,
      remainingCredits,
    });

    return NextResponse.json({
      status: "completed",
      jobId,
      videoUrl: savedVideoUrl,
      remainingCredits,
    });
  } catch (error) {
    console.error("[VidForge] GET fatal error:", error);

    return jsonError(
      error instanceof Error
        ? error.message
        : "Could not retrieve generated video.",
      500
    );
  }
}