import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const OPENROUTER_VIDEO_MODEL = "google/veo-3.1-lite";
const STORAGE_BUCKET = "input-images";

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

if (!SUPABASE_URL) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL is missing."
  );
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is missing."
  );
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

/* =========================================================
   BASIC HELPERS
========================================================= */

function json(
  data: unknown,
  status = 200
) {
  return NextResponse.json(data, { status });
}

function errorMessage(error: unknown): string {
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

function getPricing(
  duration: Duration,
  hasAudio: boolean
) {
  if (duration === 4) {
    return {
      cost: hasAudio ? 40 : 25,
    };
  }

  if (duration === 6) {
    return {
      cost: hasAudio ? 60 : 40,
    };
  }

  return {
    cost: hasAudio ? 80 : 50,
  };
}

/* =========================================================
   AUTH
========================================================= */

async function authenticateUser(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    throw new Error(
      "Missing authorization token."
    );
  }

  const token = authorization
    .slice("Bearer ".length)
    .trim();

  if (!token) {
    throw new Error(
      "Missing authorization token."
    );
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    console.error(
      "Supabase authentication error:",
      error
    );

    throw new Error(
      "Invalid or expired authentication token."
    );
  }

  return user;
}

/* =========================================================
   CREDITS
========================================================= */

async function getUserCredits(
  userId: string
): Promise<number> {
  const { data, error } =
    await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

  if (error) {
    throw new Error(
      `Unable to read credits: ${error.message}`
    );
  }

  const credits = Number(
    data?.credits ?? 0
  );

  if (!Number.isFinite(credits)) {
    throw new Error(
      "Invalid credits value."
    );
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

  const newCredits =
    currentCredits - cost;

  const { data, error } =
    await supabaseAdmin
      .from("profiles")
      .update({
        credits: newCredits,
      })
      .eq("id", userId)
      .eq("credits", currentCredits)
      .select("credits")
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to deduct credits: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      "Unable to deduct credits. Your balance may have changed. Please try again."
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
    const currentCredits =
      await getUserCredits(userId);

    const newCredits =
      currentCredits + amount;

    const { data, error } =
      await supabaseAdmin
        .from("profiles")
        .update({
          credits: newCredits,
        })
        .eq("id", userId)
        .select("credits")
        .single();

    if (error || !data) {
      console.error(
        "Credit refund failed:",
        error
      );

      return null;
    }

    return Number(data.credits);
  } catch (error) {
    console.error(
      "Credit refund exception:",
      error
    );

    return null;
  }
}

/* =========================================================
   PROMPT
========================================================= */

function buildVeoPrompt(
  script: string,
  duration: Duration,
  hasAudio: boolean
) {
  const audioInstruction =
    hasAudio
      ? `
Generate natural synchronized audio.
The spoken narration should follow the supplied script.
Use clear, natural speech and appropriate background ambience.
`
      : `
Do not generate spoken narration or dialogue.
Keep the video silent.
`;

  return `
Create a polished cinematic vertical video using the supplied image as the first frame.

SCRIPT:
${script}

VIDEO:
- Duration: ${duration} seconds.
- Aspect ratio: 9:16 vertical.
- Preserve the identity and appearance of the main subject.
- Start from the supplied image.
- Animate the subject naturally.
- Use smooth cinematic camera movement.
- Maintain strong visual consistency.
- Do not unnecessarily change the scene.
- Do not replace the main subject.
- Avoid distorted faces.
- Avoid extra fingers or limbs.
- Avoid duplicate people.
- Avoid warped objects.
- Keep the result realistic and professional.
- Make it suitable for social media.

AUDIO:
${audioInstruction}
`.trim();
}

/* =========================================================
   STORAGE
========================================================= */

async function uploadInputImage(
  userId: string,
  image: File
): Promise<{
  path: string;
  publicUrl: string;
  providerUrl: string;
}> {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
  ];

  if (
    !image.type ||
    !allowedTypes.includes(image.type)
  ) {
    throw new Error(
      `Unsupported image type: ${
        image.type || "unknown"
      }. Please use PNG, JPG, JPEG, or WebP.`
    );
  }

  const maxSize =
    10 * 1024 * 1024;

  if (image.size <= 0) {
    throw new Error(
      "The uploaded image is empty."
    );
  }

  if (image.size > maxSize) {
    throw new Error(
      "Image is too large. Maximum size is 10 MB."
    );
  }

  let extension = "jpg";

  if (image.type === "image/png") {
    extension = "png";
  }

  if (image.type === "image/webp") {
    extension = "webp";
  }

  const filePath =
    `generated-inputs/${userId}/${crypto.randomUUID()}.${extension}`;

  const arrayBuffer =
    await image.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  console.log(
    "Uploading source image:",
    {
      bucket: STORAGE_BUCKET,
      path: filePath,
      size: buffer.length,
      type: image.type,
    }
  );

  const { error: uploadError } =
    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(
        filePath,
        buffer,
        {
          contentType: image.type,
          cacheControl: "3600",
          upsert: false,
        }
      );

  if (uploadError) {
    console.error(
      "Supabase image upload failed:",
      uploadError
    );

    throw new Error(
      `Unable to upload image to Supabase: ${uploadError.message}`
    );
  }

  /*
   * Normal browser/public URL.
   * Useful if the bucket is public.
   */
  const {
    data: publicData,
  } =
    supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

  const publicUrl =
    publicData?.publicUrl || "";

  /*
   * IMPORTANT:
   * Create a temporary signed URL for OpenRouter.
   *
   * This works even when the bucket is private.
   */
  const {
    data: signedData,
    error: signedError,
  } =
    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(
        filePath,
        60 * 60
      );

  if (signedError) {
    console.error(
      "Could not create signed image URL:",
      signedError
    );

    throw new Error(
      `Image uploaded, but a temporary image URL could not be created: ${signedError.message}`
    );
  }

  if (
    !signedData?.signedUrl
  ) {
    throw new Error(
      "Image uploaded, but Supabase did not return a signed URL."
    );
  }

  console.log(
    "Source image uploaded successfully:",
    filePath
  );

  return {
    path: filePath,
    publicUrl,
    providerUrl:
      signedData.signedUrl,
  };
}

/* =========================================================
   DATABASE
========================================================= */

async function createPendingVideoRecord(
  params: {
    userId: string;
    prompt: string;
    imageUrl: string;
    duration: Duration;
    cost: number;
    hasAudio: boolean;
  }
) {
  const {
    userId,
    prompt,
    imageUrl,
    duration,
    cost,
    hasAudio,
  } = params;

  const { data, error } =
    await supabaseAdmin
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

  return String(data.id);
}

async function attachJobToVideoRecord(
  recordId: string,
  jobId: string
) {
  const { error } =
    await supabaseAdmin
      .from("user_videos")
      .update({
        video_url:
          `pending:${jobId}`,
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
  const { error } =
    await supabaseAdmin
      .from("user_videos")
      .update({
        video_url:
          `failed:${stage}:${Date.now()}`,
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
  const { error } =
    await supabaseAdmin
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

/* =========================================================
   FIND JOB
========================================================= */

async function findUserJob(
  userId: string,
  jobId: string
): Promise<VideoJobRecord | null> {
  const { data, error } =
    await supabaseAdmin
      .from("user_videos")
      .select(
        `
        id,
        user_id,
        prompt,
        image_url,
        video_url,
        duration,
        cost,
        has_audio
        `
      )
      .eq("user_id", userId)
      .eq(
        "video_url",
        `pending:${jobId}`
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to find video job: ${error.message}`
    );
  }

  return data as VideoJobRecord | null;
}

/* =========================================================
   OPENROUTER
========================================================= */

function openRouterHeaders() {
  return {
    Authorization:
      `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type":
      "application/json",
    "HTTP-Referer":
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://vidforgeai.com.ng",
    "X-Title":
      "VidForge AI",
  };
}

async function submitOpenRouterVideo(
  params: {
    prompt: string;
    imageUrl: string;
    duration: Duration;
    hasAudio: boolean;
  }
) {
  const {
    prompt,
    imageUrl,
    duration,
    hasAudio,
  } = params;

  console.log(
    "Submitting video to OpenRouter:",
    {
      model:
        OPENROUTER_VIDEO_MODEL,
      duration,
      hasAudio,
    }
  );

  const response =
    await fetch(
      "https://openrouter.ai/api/v1/videos",
      {
        method: "POST",
        headers:
          openRouterHeaders(),
        body: JSON.stringify({
          model:
            OPENROUTER_VIDEO_MODEL,

          prompt,

          duration,

          aspect_ratio:
            "9:16",

          generate_audio:
            hasAudio,

          frame_images: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
              frame_type:
                "first_frame",
            },
          ],
        }),
      }
    );

  const rawText =
    await response.text();

  let data: any = null;

  try {
    data = rawText
      ? JSON.parse(rawText)
      : null;
  } catch {
    data = null;
  }

  console.log(
    "OpenRouter response:",
    {
      status:
        response.status,
      ok:
        response.ok,
      body:
        data ||
        rawText.slice(0, 1000),
    }
  );

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.error?.details ||
      data?.message ||
      rawText ||
      `OpenRouter returned HTTP ${response.status}`;

    throw new Error(
      `OpenRouter: ${message}`
    );
  }

  const jobId =
    data?.id ||
    data?.job_id ||
    data?.data?.id ||
    data?.data?.job_id;

  if (
    !jobId ||
    typeof jobId !== "string"
  ) {
    throw new Error(
      "OpenRouter accepted the request but did not return a video job ID."
    );
  }

  return jobId;
}

async function getOpenRouterVideoJob(
  jobId: string
) {
  const response =
    await fetch(
      `https://openrouter.ai/api/v1/videos/${encodeURIComponent(
        jobId
      )}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${OPENROUTER_API_KEY}`,
        },
        cache: "no-store",
      }
    );

  const rawText =
    await response.text();

  let data: any = null;

  try {
    data = rawText
      ? JSON.parse(rawText)
      : null;
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

/* =========================================================
   PROVIDER STATUS
========================================================= */

function normalizeProviderStatus(
  data: any
): string {
  const status =
    data?.status ||
    data?.data?.status ||
    data?.state ||
    data?.data?.state ||
    "";

  return String(status)
    .toLowerCase()
    .trim();
}

function extractUnsignedVideoUrl(
  data: any
): string | null {
  const candidates = [
    ...(Array.isArray(
      data?.unsigned_urls
    )
      ? data.unsigned_urls
      : []),

    ...(Array.isArray(
      data?.data?.unsigned_urls
    )
      ? data.data.unsigned_urls
      : []),

    data?.video_url,
    data?.videoUrl,
    data?.url,

    data?.data?.video_url,
    data?.data?.videoUrl,
    data?.data?.url,
  ];

  for (
    const candidate of candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.startsWith(
        "http"
      )
    ) {
      return candidate;
    }
  }

  return null;
}

/* =========================================================
   DOWNLOAD VIDEO
========================================================= */

async function downloadOpenRouterVideo(
  jobId: string,
  data: any
): Promise<Buffer> {
  const unsignedUrl =
    extractUnsignedVideoUrl(data);

  if (unsignedUrl) {
    console.log(
      "Downloading generated video from unsigned URL."
    );

    const response =
      await fetch(
        unsignedUrl
      );

    if (!response.ok) {
      throw new Error(
        `Video download failed with HTTP ${response.status}.`
      );
    }

    const arrayBuffer =
      await response.arrayBuffer();

    return Buffer.from(
      arrayBuffer
    );
  }

  console.log(
    "No unsigned URL found. Using OpenRouter content endpoint."
  );

  const contentUrl =
    `https://openrouter.ai/api/v1/videos/${encodeURIComponent(
      jobId
    )}/content?index=0`;

  const response =
    await fetch(
      contentUrl,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${OPENROUTER_API_KEY}`,
        },
      }
    );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `OpenRouter video content retrieval failed: ${
        text ||
        response.status
      }`
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  return Buffer.from(
    arrayBuffer
  );
}

/* =========================================================
   SAVE GENERATED MP4
========================================================= */

async function saveGeneratedVideo(
  userId: string,
  jobId: string,
  videoBuffer: Buffer
): Promise<string> {
  const filePath =
    `generated-videos/${userId}/${jobId}.mp4`;

  console.log(
    "Saving generated MP4:",
    {
      bucket:
        STORAGE_BUCKET,
      path:
        filePath,
      bytes:
        videoBuffer.length,
    }
  );

  const { error } =
    await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(
        filePath,
        videoBuffer,
        {
          contentType:
            "video/mp4",
          cacheControl:
            "3600",
          upsert: true,
        }
      );

  if (error) {
    throw new Error(
      `Unable to save generated video to Supabase: ${error.message}`
    );
  }

  const {
    data: publicData,
  } =
    supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

  if (
    !publicData?.publicUrl
  ) {
    throw new Error(
      "Video was saved, but Supabase did not return a public video URL."
    );
  }

  return publicData.publicUrl;
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  let recordId:
    | string
    | null = null;

  let userId:
    | string
    | null = null;

  let chargedCredits = 0;

  let creditsWereDeducted =
    false;

  try {
    /* -----------------------------------------------------
       ENVIRONMENT CHECK
    ----------------------------------------------------- */

    if (!OPENROUTER_API_KEY) {
      return json(
        {
          error:
            "OPENROUTER_API_KEY is not configured in Vercel.",
        },
        500
      );
    }

    if (
      !SUPABASE_URL ||
      !SUPABASE_SERVICE_ROLE_KEY
    ) {
      return json(
        {
          error:
            "Supabase server environment variables are not configured in Vercel.",
        },
        500
      );
    }

    /* -----------------------------------------------------
       AUTH
    ----------------------------------------------------- */

    const user =
      await authenticateUser(
        request
      );

    userId = user.id;

    /* -----------------------------------------------------
       FORM DATA
    ----------------------------------------------------- */

    const formData =
      await request.formData();

    const scriptValue =
      formData.get("script");

    const imageValue =
      formData.get("image");

    const durationValue =
      formData.get("duration");

    const audioValue =
      formData.get("hasAudio");

    console.log(
      "Generation request received:",
      {
        userId:
          user.id,
        hasScript:
          typeof scriptValue ===
          "string",
        imageIsFile:
          imageValue instanceof File,
        imageType:
          imageValue instanceof File
            ? imageValue.type
            : null,
        imageSize:
          imageValue instanceof File
            ? imageValue.size
            : null,
        duration:
          durationValue,
        hasAudio:
          audioValue,
      }
    );

    /* -----------------------------------------------------
       VALIDATE SCRIPT
    ----------------------------------------------------- */

    if (
      typeof scriptValue !==
        "string" ||
      !scriptValue.trim()
    ) {
      return json(
        {
          error:
            "Please provide a script.",
        },
        400
      );
    }

    /* -----------------------------------------------------
       VALIDATE IMAGE
    ----------------------------------------------------- */

    if (
      !(imageValue instanceof File)
    ) {
      return json(
        {
          error:
            "Please upload an image. The image must be sent as a FormData file named 'image'.",
        },
        400
      );
    }

    if (imageValue.size <= 0) {
      return json(
        {
          error:
            "The selected image is empty.",
        },
        400
      );
    }

    /* -----------------------------------------------------
       VALIDATE DURATION
    ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       AUDIO
    ----------------------------------------------------- */

    const hasAudio =
      audioValue === "true" ||
      audioValue === "1" ||
      audioValue === "on";

    const script =
      scriptValue.trim();

    const { cost } =
      getPricing(
        duration,
        hasAudio
      );

    /* -----------------------------------------------------
       CHECK CREDITS
    ----------------------------------------------------- */

    const currentCredits =
      await getUserCredits(
        user.id
      );

    if (
      currentCredits < cost
    ) {
      return json(
        {
          error:
            `Not enough credits. You need ${cost} credits but only have ${currentCredits}.`,
          remainingCredits:
            currentCredits,
          requiredCredits:
            cost,
        },
        402
      );
    }

    /* -----------------------------------------------------
       UPLOAD IMAGE
    ----------------------------------------------------- */

    const uploaded =
      await uploadInputImage(
        user.id,
        imageValue
      );

    /*
     * Save the permanent/public URL to our DB when
     * available. OpenRouter receives the signed URL.
     */
    const imageUrlForDatabase =
      uploaded.publicUrl ||
      uploaded.providerUrl;

    /* -----------------------------------------------------
       CREATE DATABASE RECORD
    ----------------------------------------------------- */

    recordId =
      await createPendingVideoRecord(
        {
          userId:
            user.id,
          prompt:
            script,
          imageUrl:
            imageUrlForDatabase,
          duration,
          cost,
          hasAudio,
        }
      );

    /* -----------------------------------------------------
       DEDUCT CREDITS
    ----------------------------------------------------- */

    const remainingCredits =
      await deductCredits(
        user.id,
        cost,
        currentCredits
      );

    chargedCredits =
      cost;

    creditsWereDeducted =
      true;

    /* -----------------------------------------------------
       PROMPT
    ----------------------------------------------------- */

    const veoPrompt =
      buildVeoPrompt(
        script,
        duration,
        hasAudio
      );

    /* -----------------------------------------------------
       SUBMIT TO OPENROUTER
    ----------------------------------------------------- */

    let jobId: string;

    try {
      jobId =
        await submitOpenRouterVideo(
          {
            prompt:
              veoPrompt,

            /*
             * IMPORTANT:
             * Send signed URL to OpenRouter so it can
             * actually fetch the Supabase image.
             */
            imageUrl:
              uploaded.providerUrl,

            duration,

            hasAudio,
          }
        );
    } catch (error) {
      console.error(
        "VIDEO SUBMISSION FAILED:",
        error
      );

      if (recordId) {
        await markVideoFailed(
          user.id,
          recordId,
          "submission"
        );
      }

      if (
        creditsWereDeducted
      ) {
        await refundCredits(
          user.id,
          chargedCredits
        );

        creditsWereDeducted =
          false;
      }

      return json(
        {
          error:
            errorMessage(
              error
            ),
          stage:
            "openrouter_submission",
          remainingCredits:
            await getUserCredits(
              user.id
            ).catch(
              () => null
            ),
        },
        502
      );
    }

    /* -----------------------------------------------------
       ATTACH JOB
    ----------------------------------------------------- */

    if (recordId) {
      try {
        await attachJobToVideoRecord(
          recordId,
          jobId
        );
      } catch (error) {
        /*
         * Do NOT refund.
         * OpenRouter job already exists.
         */
        console.error(
          "Could not attach job ID to database:",
          error
        );
      }
    }

    console.log(
      "VIDEO JOB CREATED:",
      jobId
    );

    return json({
      success:
        true,
      jobId,
      status:
        "processing",
      remainingCredits,
      duration,
      hasAudio,
    });
  } catch (error) {
    console.error(
      "POST /api/generate-script-video FAILED:",
      error
    );

    /*
     * Refund only if we know credits were deducted
     * and the provider job was never created.
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
            .select(
              "video_url"
            )
            .eq(
              "id",
              recordId
            )
            .eq(
              "user_id",
              userId
            )
            .maybeSingle();

        const videoUrl =
          data?.video_url;

        if (
          typeof videoUrl ===
            "string" &&
          videoUrl ===
            "pending:submitting"
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
      } catch (
        cleanupError
      ) {
        console.error(
          "Emergency cleanup failed:",
          cleanupError
        );
      }
    }

    return json(
      {
        error:
          errorMessage(
            error
          ),
          stage:
            "post_generation_request",
      },
      500
    );
  }
}

/* =========================================================
   GET
   POLL VIDEO JOB
========================================================= */

export async function GET(
  request: NextRequest
) {
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
      await authenticateUser(
        request
      );

    const url =
      new URL(
        request.url
      );

    const jobId =
      url.searchParams.get(
        "jobId"
      );

    const download =
      url.searchParams.get(
        "download"
      ) === "true";

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

    /* -----------------------------------------------------
       POLL PROVIDER
    ----------------------------------------------------- */

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

      return json({
        status:
          "processing",
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

    console.log(
      "VIDEO JOB STATUS:",
      {
        jobId,
        providerStatus,
      }
    );

    /* -----------------------------------------------------
       FAILED
    ----------------------------------------------------- */

    const failedStatuses =
      [
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
        Number(
          userJob.cost || 0
        );

      if (
        userJob.video_url?.startsWith(
          "pending:"
        )
      ) {
        await markVideoFailed(
          user.id,
          userJob.id,
          providerStatus ||
            "provider"
        );

        if (
          refundAmount >
          0
        ) {
          await refundCredits(
            user.id,
            refundAmount
          );
        }
      }

      return json({
        status:
          "failed",
        error:
          "The video provider could not generate this video. Your credits have been refunded.",
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    /* -----------------------------------------------------
       COMPLETED?
    ----------------------------------------------------- */

    const completedStatuses =
      [
        "completed",
        "complete",
        "succeeded",
        "success",
      ];

    const providerVideoUrl =
      extractUnsignedVideoUrl(
        providerData
      );

    const isCompleted =
      completedStatuses.includes(
        providerStatus
      ) ||
      !!providerVideoUrl;

    if (!isCompleted) {
      return json({
        status:
          "processing",
        jobId,
        providerStatus:
          providerStatus ||
          "processing",
        remainingCredits:
          await getUserCredits(
            user.id
          ),
      });
    }

    /* -----------------------------------------------------
       DOWNLOAD MP4
    ----------------------------------------------------- */

    let videoBuffer: Buffer;

    try {
      videoBuffer =
        await downloadOpenRouterVideo(
          jobId,
          providerData
        );
    } catch (error) {
      console.error(
        "VIDEO DOWNLOAD FAILED:",
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
          "download"
        );

        await refundCredits(
          user.id,
          Number(
            userJob.cost || 0
          )
        );
      }

      return json(
        {
          status:
            "failed",
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
      videoBuffer.length ===
        0
    ) {
      await markVideoFailed(
        user.id,
        userJob.id,
        "empty-video"
      );

      await refundCredits(
        user.id,
        Number(
          userJob.cost || 0
        )
      );

      return json(
        {
          status:
            "failed",
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

    /* -----------------------------------------------------
       SAVE MP4 TO SAME SUPABASE BUCKET
    ----------------------------------------------------- */

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
        "VIDEO STORAGE FAILED:",
        error
      );

      await markVideoFailed(
        user.id,
        userJob.id,
        "storage"
      );

      await refundCredits(
        user.id,
        Number(
          userJob.cost || 0
        )
      );

      return json(
        {
          status:
            "failed",
          error:
            "The video was generated but could not be saved to Supabase. Your credits have been refunded.",
          remainingCredits:
            await getUserCredits(
              user.id
            ),
        },
        500
      );
    }

    /* -----------------------------------------------------
       DATABASE COMPLETION
    ----------------------------------------------------- */

    try {
      await markVideoCompleted(
        user.id,
        userJob.id,
        savedVideoUrl
      );
    } catch (error) {
      /*
       * DO NOT REFUND.
       *
       * The MP4 already exists.
       */
      console.error(
        "Video DB completion update failed:",
        error
      );
    }

    console.log(
      "VIDEO COMPLETED:",
      {
        jobId,
        videoUrl:
          savedVideoUrl,
        bytes:
          videoBuffer.length,
      }
    );

    /* -----------------------------------------------------
       OPTIONAL DIRECT DOWNLOAD
    ----------------------------------------------------- */

    if (download) {
      return NextResponse.redirect(
        savedVideoUrl
      );
    }

    /* -----------------------------------------------------
       FINAL RESPONSE
    ----------------------------------------------------- */

    return json({
      status:
        "completed",
      videoUrl:
        savedVideoUrl,
      remainingCredits:
        await getUserCredits(
          user.id
        ),
    });
  } catch (error) {
    console.error(
      "GET /api/generate-script-video FAILED:",
      error
    );

    return json(
      {
        error:
          errorMessage(
            error
          ),
        stage:
          "video_polling",
      },
      500
    );
  }
}