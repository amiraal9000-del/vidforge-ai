import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const OPENROUTER_VIDEO_MODEL = "google/veo-3.1-lite";
const STORAGE_BUCKET = "input-images";

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type Duration = 4 | 6 | 8;

type VideoJobRecord = {
  id: string;
  user_id: string;
  prompt: string | null;
  image_url: string | null;
  video_url: string | null;
  duration: number;
  cost: number;
  has_audio: boolean;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getPricing(duration: Duration, hasAudio: boolean) {
  if (duration === 4) {
    return hasAudio
      ? { cost: 40 }
      : { cost: 25 };
  }

  if (duration === 6) {
    return hasAudio
      ? { cost: 60 }
      : { cost: 40 };
  }

  return hasAudio
    ? { cost: 80 }
    : { cost: 50 };
}

async function authenticateUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing authorization token");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new Error("Missing authorization token");
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    throw new Error("Invalid or expired authentication token");
  }

  return user;
}

async function getUserCredits(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`Unable to read credits: ${error.message}`);
  }

  const credits = Number(data?.credits ?? 0);

  if (!Number.isFinite(credits)) {
    throw new Error("Invalid credits value");
  }

  return credits;
}

async function deductCredits(
  userId: string,
  cost: number,
  currentCredits: number
): Promise<number> {
  if (currentCredits < cost) {
    throw new Error(
      `Not enough credits. You need ${cost} credits but only have ${currentCredits}.`
    );
  }

  const newCredits = currentCredits - cost;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      credits: newCredits,
    })
    .eq("id", userId)
    .eq("credits", currentCredits)
    .select("credits")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to deduct credits. Please try again."
    );
  }

  return Number(data.credits);
}

async function refundCredits(
  userId: string,
  amount: number
): Promise<number | null> {
  if (!amount || amount <= 0) {
    return null;
  }

  try {
    const currentCredits = await getUserCredits(userId);
    const refundedCredits = currentCredits + amount;

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({
        credits: refundedCredits,
      })
      .eq("id", userId)
      .select("credits")
      .single();

    if (error || !data) {
      console.error("Credit refund failed:", error);
      return null;
    }

    return Number(data.credits);
  } catch (error) {
    console.error("Credit refund exception:", error);
    return null;
  }
}

function buildVeoPrompt(
  script: string,
  duration: Duration,
  hasAudio: boolean
) {
  const audioInstruction = hasAudio
    ? "Generate natural synchronized audio, including clear spoken narration matching the script."
    : "Do not generate spoken narration or dialogue. Keep the video silent.";

  return `
Create a polished cinematic vertical video based on the provided first-frame image.

SCRIPT:
${script}

VIDEO REQUIREMENTS:
- Duration: ${duration} seconds
- Aspect ratio: 9:16 vertical
- Preserve the main subject and visual identity from the supplied image.
- Animate the scene naturally and smoothly.
- Use realistic movement and cinematic camera motion.
- Keep the subject visually consistent throughout the video.
- Make the result feel like a professional social-media video.
- Avoid unnecessary scene changes.
- Avoid distorted faces, extra fingers, duplicate people, warped objects, or unnatural movements.
- ${audioInstruction}
`.trim();
}

async function uploadInputImage(
  userId: string,
  image: File
): Promise<string> {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  if (!allowedTypes.includes(image.type)) {
    throw new Error(
      "Unsupported image type. Please use PNG, JPG, JPEG, or WebP."
    );
  }

  const maxSize = 10 * 1024 * 1024;

  if (image.size > maxSize) {
    throw new Error("Image is too large. Maximum size is 10 MB.");
  }

  const extension =
    image.type === "image/png"
      ? "png"
      : image.type === "image/webp"
        ? "webp"
        : "jpg";

  const filePath = `${userId}/${crypto.randomUUID()}.${extension}`;

  const arrayBuffer = await image.arrayBuffer();

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, Buffer.from(arrayBuffer), {
      contentType: image.type,
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Unable to upload image: ${error.message}`
    );
  }

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("Unable to create public image URL");
  }

  return data.publicUrl;
}

async function createPendingVideoRecord(params: {
  userId: string;
  prompt: string;
  imageUrl: string;
  duration: Duration;
  cost: number;
  hasAudio: boolean;
}) {
  const {
    userId,
    prompt,
    imageUrl,
    duration,
    cost,
    hasAudio,
  } = params;

  const { data, error } = await supabaseAdmin
    .from("user_videos")
    .insert({
      user_id: userId,
      prompt,
      image_url: imageUrl,
      video_url: "pending:submitting",
      duration,
      cost,
      has_audio: hasAudio,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      error?.message ||
        "Unable to create video record."
    );
  }

  return data.id as string;
}

async function attachJobToVideoRecord(
  recordId: string,
  jobId: string
) {
  const { error } = await supabaseAdmin
    .from("user_videos")
    .update({
      video_url: `pending:${jobId}`,
    })
    .eq("id", recordId);

  if (error) {
    throw new Error(
      `Unable to attach video job: ${error.message}`
    );
  }
}

async function markVideoFailed(
  userId: string,
  recordId: string,
  stage: string
) {
  const { error } = await supabaseAdmin
    .from("user_videos")
    .update({
      video_url: `failed:${stage}:${Date.now()}`,
    })
    .eq("id", recordId)
    .eq("user_id", userId);

  if (error) {
    console.error(
      "Unable to mark video failed:",
      error
    );
  }
}

async function markVideoCompleted(
  userId: string,
  recordId: string,
  videoUrl: string
) {
  const { error } = await supabaseAdmin
    .from("user_videos")
    .update({
      video_url: videoUrl,
    })
    .eq("id", recordId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(
      `Unable to save video record: ${error.message}`
    );
  }
}

async function findUserJob(
  userId: string,
  jobId: string
): Promise<VideoJobRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("user_videos")
    .select(
      "id,user_id,prompt,image_url,video_url,duration,cost,has_audio"
    )
    .eq("user_id", userId)
    .or(
      `video_url.eq.pending:${jobId},video_url.like.%/${jobId}.mp4`
    )
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find video job: ${error.message}`
    );
  }

  return data as VideoJobRecord | null;
}

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://vidforgeai.com.ng",
    "X-Title": "VidForge AI",
  };
}

async function submitOpenRouterVideo(params: {
  prompt: string;
  imageUrl: string;
  duration: Duration;
  hasAudio: boolean;
}) {
  const {
    prompt,
    imageUrl,
    duration,
    hasAudio,
  } = params;

  const response = await fetch(
    "https://openrouter.ai/api/v1/videos",
    {
      method: "POST",
      headers: openRouterHeaders(),
      body: JSON.stringify({
        model: OPENROUTER_VIDEO_MODEL,

        prompt,

        duration,

        aspect_ratio: "9:16",

        generate_audio: hasAudio,

        frame_images: [
          {
            type: "image_url",
            image_url: {
              url: imageUrl,
            },
            frame_type: "first_frame",
          },
        ],
      }),
    }
  );

  const rawText = await response.text();

  let data: any = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      rawText ||
      `OpenRouter request failed with status ${response.status}`;

    throw new Error(message);
  }

  const jobId =
    data?.id ||
    data?.job_id ||
    data?.data?.id ||
    data?.data?.job_id;

  if (!jobId || typeof jobId !== "string") {
    throw new Error(
      "OpenRouter did not return a video job ID."
    );
  }

  return jobId;
}

async function getOpenRouterVideoJob(
  jobId: string
) {
  const response = await fetch(
    `https://openrouter.ai/api/v1/videos/${encodeURIComponent(
      jobId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      },
      cache: "no-store",
    }
  );

  const rawText = await response.text();

  let data: any = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      rawText ||
      `OpenRouter polling failed with status ${response.status}`;

    throw new Error(message);
  }

  return data;
}

function normalizeProviderStatus(data: any): string {
  const status =
    data?.status ||
    data?.data?.status ||
    data?.state ||
    data?.data?.state ||
    "";

  return String(status).toLowerCase();
}

function extractUnsignedVideoUrl(data: any): string | null {
  const candidates = [
    ...(Array.isArray(data?.unsigned_urls)
      ? data.unsigned_urls
      : []),

    ...(Array.isArray(data?.data?.unsigned_urls)
      ? data.data.unsigned_urls
      : []),

    data?.video_url,
    data?.videoUrl,
    data?.url,
    data?.data?.video_url,
    data?.data?.videoUrl,
    data?.data?.url,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.startsWith("http")
    ) {
      return candidate;
    }
  }

  return null;
}

async function downloadOpenRouterVideo(
  jobId: string,
  data: any
): Promise<Buffer> {
  const unsignedUrl =
    extractUnsignedVideoUrl(data);

  if (unsignedUrl) {
    const response = await fetch(unsignedUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to download generated video. Status ${response.status}`
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    return Buffer.from(arrayBuffer);
  }

  const contentUrl =
    `https://openrouter.ai/api/v1/videos/${encodeURIComponent(
      jobId
    )}/content?index=0`;

  const response = await fetch(contentUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Unable to retrieve generated video: ${errorText || response.status}`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  return Buffer.from(arrayBuffer);
}

async function saveGeneratedVideo(
  userId: string,
  jobId: string,
  videoBuffer: Buffer
): Promise<string> {
  const filePath =
    `generated-videos/${userId}/${jobId}.mp4`;

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(
      filePath,
      videoBuffer,
      {
        contentType: "video/mp4",
        upsert: true,
      }
    );

  if (error) {
    throw new Error(
      `Unable to save generated video: ${error.message}`
    );
  }

  const { data } = supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error(
      "Unable to create public video URL."
    );
  }

  return data.publicUrl;
}

/* =========================================================
   POST
   Creates a video generation job
========================================================= */

export async function POST(request: NextRequest) {
  let recordId: string | null = null;
  let userId: string | null = null;
  let chargedCredits = 0;
  let creditsWereDeducted = false;

  try {
    if (!OPENROUTER_API_KEY) {
      return json(
        {
          error:
            "OPENROUTER_API_KEY is not configured.",
        },
        500
      );
    }

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY ||
      !SUPABASE_ANON_KEY
    ) {
      return json(
        {
          error:
            "Supabase environment variables are not configured.",
        },
        500
      );
    }

    const user = await authenticateUser(request);

    userId = user.id;

    const formData = await request.formData();

    const scriptValue = formData.get("script");
    const imageValue = formData.get("image");
    const durationValue = formData.get("duration");
    const audioValue = formData.get("hasAudio");

    if (
      typeof scriptValue !== "string" ||
      !scriptValue.trim()
    ) {
      return json(
        {
          error: "Please provide a script.",
        },
        400
      );
    }

    if (!(imageValue instanceof File)) {
      return json(
        {
          error: "Please upload an image.",
        },
        400
      );
    }

    const parsedDuration =
      Number(durationValue);

    if (
      parsedDuration !== 4 &&
      parsedDuration !== 6 &&
      parsedDuration !== 8
    ) {
      return json(
        {
          error:
            "Duration must be 4, 6, or 8 seconds.",
        },
        400
      );
    }

    const duration =
      parsedDuration as Duration;

    const hasAudio =
      audioValue === "true" ||
      audioValue === "1" ||
      audioValue === "on";

    const script = scriptValue.trim();

    const { cost } = getPricing(
      duration,
      hasAudio
    );

    const currentCredits =
      await getUserCredits(user.id);

    if (currentCredits < cost) {
      return json(
        {
          error: `Not enough credits. You need ${cost} credits but only have ${currentCredits}.`,
          remainingCredits: currentCredits,
          requiredCredits: cost,
        },
        402
      );
    }

    /*
     * Upload the original image first.
     */
    const imageUrl =
      await uploadInputImage(
        user.id,
        imageValue
      );

    /*
     * Create our database record before
     * submitting the provider job.
     */
    recordId =
      await createPendingVideoRecord({
        userId: user.id,
        prompt: script,
        imageUrl,
        duration,
        cost,
        hasAudio,
      });

    /*
     * Deduct credits only after the record exists.
     */
    const remainingCredits =
      await deductCredits(
        user.id,
        cost,
        currentCredits
      );

    chargedCredits = cost;
    creditsWereDeducted = true;

    /*
     * Build the final Veo prompt.
     */
    const veoPrompt =
      buildVeoPrompt(
        script,
        duration,
        hasAudio
      );

    /*
     * Submit to OpenRouter.
     */
    let jobId: string;

    try {
      jobId =
        await submitOpenRouterVideo({
          prompt: veoPrompt,
          imageUrl,
          duration,
          hasAudio,
        });
    } catch (error) {
      console.error(
        "OpenRouter submission failed:",
        error
      );

      if (recordId) {
        await markVideoFailed(
          user.id,
          recordId,
          "submission"
        );
      }

      if (creditsWereDeducted) {
        await refundCredits(
          user.id,
          chargedCredits
        );
        creditsWereDeducted = false;
      }

      return json(
        {
          error:
            getErrorMessage(error),
          remainingCredits:
            await getUserCredits(user.id).catch(
              () => null
            ),
        },
        502
      );
    }

    /*
     * Attach provider job ID to our record.
     */
    try {
      if (recordId) {
        await attachJobToVideoRecord(
          recordId,
          jobId
        );
      }
    } catch (error) {
      console.error(
        "Unable to attach job ID:",
        error
      );

      /*
       * The provider job already exists, so do NOT
       * refund automatically here. The user may still
       * have a valid provider job.
       */
    }

    return json({
      success: true,
      jobId,
      status: "processing",
      remainingCredits,
      duration,
      hasAudio,
    });
  } catch (error) {
    console.error(
      "POST /api/generate-script-video error:",
      error
    );

    /*
     * Emergency cleanup/refund only when the provider
     * job was never successfully created.
     */
    if (
      userId &&
      recordId &&
      creditsWereDeducted
    ) {
      try {
        const { data } =
          await supabaseAdmin
            .from("user_videos")
            .select("video_url")
            .eq("id", recordId)
            .eq("user_id", userId)
            .single();

        const videoUrl =
          data?.video_url;

        if (
          typeof videoUrl === "string" &&
          videoUrl.startsWith(
            "pending:submitting"
          )
        ) {
          await markVideoFailed(
            userId,
            recordId,
            "unexpected"
          );

          await refundCredits(
            userId,
            chargedCredits
          );
        }
      } catch (cleanupError) {
        console.error(
          "Emergency cleanup failed:",
          cleanupError
        );
      }
    }

    return json(
      {
        error:
          getErrorMessage(error),
      },
      500
    );
  }
}

/* =========================================================
   GET
   Polls an existing OpenRouter video job
========================================================= */

export async function GET(request: NextRequest) {
  try {
    if (!OPENROUTER_API_KEY) {
      return json(
        {
          error:
            "OPENROUTER_API_KEY is not configured.",
        },
        500
      );
    }

    const user =
      await authenticateUser(request);

    const { searchParams } =
      new URL(request.url);

    const jobId =
      searchParams.get("jobId");

    const download =
      searchParams.get("download") === "true";

    if (!jobId) {
      return json(
        {
          error:
            "Missing jobId.",
        },
        400
      );
    }

    const userJob =
      await findUserJob(
        user.id,
        jobId
      );

    if (!userJob) {
      return json(
        {
          error:
            "Video job not found.",
        },
        404
      );
    }

    /*
     * If the video was already completed and saved,
     * return it immediately without polling OpenRouter.
     */
    if (
      typeof userJob.video_url ===
        "string" &&
      userJob.video_url.startsWith(
        "http"
      )
    ) {
      if (download) {
        return NextResponse.redirect(
          userJob.video_url
        );
      }

      return json({
        status: "completed",
        videoUrl: userJob.video_url,
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    /*
     * If our DB already says this job failed,
     * don't keep polling the provider.
     */
    if (
      typeof userJob.video_url ===
        "string" &&
      userJob.video_url.startsWith(
        "failed:"
      )
    ) {
      return json({
        status: "failed",
        error:
          "Video generation failed.",
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    /*
     * Poll OpenRouter.
     */
    let providerData: any;

    try {
      providerData =
        await getOpenRouterVideoJob(
          jobId
        );
    } catch (error) {
      console.error(
        "OpenRouter polling error:",
        error
      );

      /*
       * A temporary polling failure should not
       * immediately refund the user. The provider
       * job may still be running.
       */
      return json({
        status: "processing",
        jobId,
        message:
          "Video is still processing.",
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    const providerStatus =
      normalizeProviderStatus(
        providerData
      );

    /*
     * Provider failure states.
     */
    const failedStatuses = [
      "failed",
      "error",
      "cancelled",
      "canceled",
      "expired",
    ];

    if (
      failedStatuses.includes(
        providerStatus
      )
    ) {
      const refundAmount =
        Number(userJob.cost || 0);

      if (
        userJob.video_url?.startsWith(
          "pending:"
        )
      ) {
        if (
          userJob.id &&
          userJob.user_id
        ) {
          await markVideoFailed(
            user.id,
            userJob.id,
            providerStatus ||
              "provider"
          );
        }

        if (refundAmount > 0) {
          await refundCredits(
            user.id,
            refundAmount
          );
        }
      }

      return json({
        status: "failed",
        error:
          "The video provider could not generate this video. Your credits have been refunded.",
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    /*
     * Provider may use "completed", "complete",
     * "succeeded", or "success".
     */
    const completedStatuses = [
      "completed",
      "complete",
      "succeeded",
      "success",
    ];

    const isCompleted =
      completedStatuses.includes(
        providerStatus
      ) ||
      !!extractUnsignedVideoUrl(
        providerData
      );

    if (!isCompleted) {
      return json({
        status: "processing",
        jobId,
        providerStatus:
          providerStatus || "processing",
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    /*
     * Provider says the video is complete.
     * Retrieve the actual MP4.
     */
    let videoBuffer: Buffer;

    try {
      videoBuffer =
        await downloadOpenRouterVideo(
          jobId,
          providerData
        );
    } catch (error) {
      console.error(
        "Generated video retrieval failed:",
        error
      );

      /*
       * The provider says completed but we cannot
       * retrieve the actual file. Refund because the
       * user does not have a usable video.
       */
      if (
        userJob.video_url?.startsWith(
          "pending:"
        )
      ) {
        await markVideoFailed(
          user.id,
          userJob.id,
          "download"
        );

        await refundCredits(
          user.id,
          Number(userJob.cost || 0)
        );
      }

      return json(
        {
          status: "failed",
          error:
            "The video was generated but could not be retrieved. Your credits have been refunded.",
          remainingCredits:
            await getUserCredits(
              user.id
            ),
        },
        502
      );
    }

    if (
      !videoBuffer ||
      videoBuffer.length === 0
    ) {
      if (
        userJob.video_url?.startsWith(
          "pending:"
        )
      ) {
        await markVideoFailed(
          user.id,
          userJob.id,
          "empty-video"
        );

        await refundCredits(
          user.id,
          Number(userJob.cost || 0)
        );
      }

      return json(
        {
          status: "failed",
          error:
            "The generated video file was empty. Your credits have been refunded.",
          remainingCredits:
            await getUserCredits(
              user.id
            ),
        },
        502
      );
    }

    /*
     * Save MP4 into the EXISTING input-images bucket.
     */
    let savedVideoUrl: string;

    try {
      savedVideoUrl =
        await saveGeneratedVideo(
          user.id,
          jobId,
          videoBuffer
        );
    } catch (error) {
      console.error(
        "Saving generated video failed:",
        error
      );

      if (
        userJob.video_url?.startsWith(
          "pending:"
        )
      ) {
        await markVideoFailed(
          user.id,
          userJob.id,
          "storage"
        );

        await refundCredits(
          user.id,
          Number(userJob.cost || 0)
        );
      }

      return json(
        {
          status: "failed",
          error:
            "The video was generated but could not be saved. Your credits have been refunded.",
          remainingCredits:
            await getUserCredits(
              user.id
            ),
        },
        500
      );
    }

    /*
     * The MP4 now exists in Supabase.
     *
     * IMPORTANT:
     * From this point forward we do NOT refund.
     * Even if the DB update has a problem, the actual
     * video file exists.
     */
    try {
      await markVideoCompleted(
        user.id,
        userJob.id,
        savedVideoUrl
      );
    } catch (error) {
      console.error(
        "Database completion update failed:",
        error
      );

      /*
       * Return the working video URL anyway.
       * The actual MP4 has already been saved.
       */
    }

    return json({
      status: "completed",
      videoUrl: savedVideoUrl,
      remainingCredits:
        await getUserCredits(
          user.id
        ),
    });
  } catch (error) {
    console.error(
      "GET /api/generate-script-video error:",
      error
    );

    return json(
      {
        error:
          getErrorMessage(error),
      },
      500
    );
  }
}