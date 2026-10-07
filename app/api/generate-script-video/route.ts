import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const VIDEO_MODEL = "google/veo-3.1-lite";

const OPENROUTER_BASE_URL =
  "https://openrouter.ai/api/v1";

const INPUT_BUCKET = "input-images";

/*
|--------------------------------------------------------------------------
| SUPABASE
|--------------------------------------------------------------------------
*/

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      )
    : null;

/*
|--------------------------------------------------------------------------
| PRICING
|--------------------------------------------------------------------------
*/

const PRICING = {
  4: {
    audio: 40,
    silent: 25,
  },

  6: {
    audio: 60,
    silent: 40,
  },

  8: {
    audio: 80,
    silent: 50,
  },
} as const;

type SupportedDuration = 4 | 6 | 8;

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function json(
  data: Record<string, any>,
  status = 200
) {
  return NextResponse.json(data, { status });
}

/*
|--------------------------------------------------------------------------
| AUTHENTICATE USER
|--------------------------------------------------------------------------
*/

async function authenticateUser(
  request: NextRequest
) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  if (
    !authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {
    return null;
  }

  const token =
    authorization.substring(7).trim();

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } =
    await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

/*
|--------------------------------------------------------------------------
| GET USER CREDITS
|--------------------------------------------------------------------------
*/

async function getUserCredits(
  userId: string
) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const { data, error } =
    await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", userId)
      .single();

  if (error) {
    throw new Error(
      `Unable to read user credits: ${error.message}`
    );
  }

  return Number(data?.credits ?? 0);
}

/*
|--------------------------------------------------------------------------
| DEDUCT CREDITS
|--------------------------------------------------------------------------
*/

async function deductCredits(
  userId: string,
  cost: number
) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const currentCredits =
    await getUserCredits(userId);

  if (currentCredits < cost) {
    return {
      success: false,
      remainingCredits: currentCredits,
    };
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
      `Unable to update credits: ${error.message}`
    );
  }

  if (!data) {
    const latestCredits =
      await getUserCredits(userId);

    return {
      success: false,
      remainingCredits: latestCredits,
    };
  }

  return {
    success: true,
    remainingCredits:
      Number(data.credits ?? 0),
  };
}

/*
|--------------------------------------------------------------------------
| BUILD VEO PROMPT
|--------------------------------------------------------------------------
*/

function buildVeoPrompt(
  userScript: string,
  withAudio: boolean
) {
  const audioInstructions = withAudio
    ? `
AUDIO:
Generate synchronized natural speech for the character.
The character must speak the supplied dialogue clearly.
Use natural conversational timing and realistic lip synchronization.
Include subtle natural room ambience where appropriate.
Do not add unrelated narration.
`
    : `
AUDIO:
Do not generate spoken dialogue.
Do not add narration or music.
Keep the result silent.
`;

  return `
Create a polished short-form vertical social-media video using
the supplied reference image as the character's identity and
starting visual frame.

CHARACTER:
Preserve the person's identity, facial structure, hairstyle,
skin appearance, clothing and overall recognizable appearance
from the supplied image.

PERFORMANCE:
The character should behave naturally and confidently.
Use realistic facial expressions.
Use natural blinking.
Use subtle head movement.
Use believable hand and body gestures where appropriate.
Avoid exaggerated or robotic movement.

CAMERA:
Vertical 9:16 composition.
Medium close-up / talking-to-camera framing.
The character should generally look directly into the camera.
Use a subtle cinematic camera movement or gentle push-in.
Keep the character properly framed throughout the shot.

VISUAL QUALITY:
Photorealistic.
Natural skin texture.
Natural lighting.
Professional commercial/social-media appearance.
Clean composition.
Realistic motion.
Stable image quality.
No unnecessary scene changes.

IMPORTANT:
The supplied image is the identity reference and first frame.
Do not transform the person into a different person.
Do not change their identity.
Do not add additional people unless explicitly requested.
Do not create captions, subtitles, logos, watermarks or random
on-screen text unless explicitly requested.

DIALOGUE / SCRIPT:
The character should communicate the following script naturally:

"${userScript.replace(/"/g, '\\"')}"

The spoken delivery should feel like a real person talking
directly to the viewer rather than reading mechanically.

${audioInstructions}

Make the final result feel like a professionally produced
short social-media advertisement.
`.trim();
}

/*
|--------------------------------------------------------------------------
| UPLOAD INPUT IMAGE
|--------------------------------------------------------------------------
*/

async function uploadInputImage(
  file: File,
  userId: string
) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() || "jpg";

  const safeExtension = [
    "jpg",
    "jpeg",
    "png",
    "webp",
  ].includes(extension)
    ? extension
    : "jpg";

  const filename =
    `${userId}/${crypto.randomUUID()}.${safeExtension}`;

  const arrayBuffer =
    await file.arrayBuffer();

  const buffer =
    Buffer.from(arrayBuffer);

  const { error: uploadError } =
    await supabaseAdmin.storage
      .from(INPUT_BUCKET)
      .upload(
        filename,
        buffer,
        {
          contentType:
            file.type || "image/jpeg",
          upsert: false,
        }
      );

  if (uploadError) {
    throw new Error(
      `Unable to upload image: ${uploadError.message}`
    );
  }

  const {
    data: publicUrlData,
  } =
    supabaseAdmin.storage
      .from(INPUT_BUCKET)
      .getPublicUrl(filename);

  if (!publicUrlData?.publicUrl) {
    throw new Error(
      "Unable to create public image URL."
    );
  }

  return publicUrlData.publicUrl;
}

/*
|--------------------------------------------------------------------------
| CREATE PENDING VIDEO RECORD
|--------------------------------------------------------------------------
|
| The uploaded image is saved in image_url.
|
| The video initially uses:
|
| pending:<jobId>
|
| Once generation completes it becomes:
|
| /api/generate-script-video?jobId=...&download=true
|
|--------------------------------------------------------------------------
*/

async function createPendingVideoRecord({
  userId,
  prompt,
  imageUrl,
  duration,
  cost,
  withAudio,
  jobId,
}: {
  userId: string;
  prompt: string;
  imageUrl: string;
  duration: number;
  cost: number;
  withAudio: boolean;
  jobId: string;
}) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const { error } =
    await supabaseAdmin
      .from("user_videos")
      .insert({
        user_id: userId,
        prompt,
        image_url: imageUrl,
        video_url: `pending:${jobId}`,
        duration,
        cost,
        has_audio: withAudio,
      });

  if (error) {
    throw new Error(
      `Unable to create video record: ${error.message}`
    );
  }
}

/*
|--------------------------------------------------------------------------
| UPDATE VIDEO RECORD
|--------------------------------------------------------------------------
*/

async function updateVideoRecord(
  userId: string,
  jobId: string,
  videoUrl: string
) {
  if (!supabaseAdmin) {
    return;
  }

  const { error } =
    await supabaseAdmin
      .from("user_videos")
      .update({
        video_url: videoUrl,
      })
      .eq("user_id", userId)
      .eq(
        "video_url",
        `pending:${jobId}`
      );

  if (error) {
    console.error(
      "Unable to update user_videos:",
      error
    );
  }
}

/*
|--------------------------------------------------------------------------
| FIND USER'S JOB
|--------------------------------------------------------------------------
*/

async function findUserJob(
  userId: string,
  jobId: string
) {
  if (!supabaseAdmin) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  const pendingMarker =
    `pending:${jobId}`;

  const failedMarker =
    `failed:${jobId}`;

  const proxyUrl =
    `/api/generate-script-video?jobId=${encodeURIComponent(
      jobId
    )}&download=true`;

  const { data: pending } =
    await supabaseAdmin
      .from("user_videos")
      .select("*")
      .eq("user_id", userId)
      .eq(
        "video_url",
        pendingMarker
      )
      .maybeSingle();

  if (pending) {
    return pending;
  }

  const { data: completed } =
    await supabaseAdmin
      .from("user_videos")
      .select("*")
      .eq("user_id", userId)
      .eq(
        "video_url",
        proxyUrl
      )
      .maybeSingle();

  if (completed) {
    return completed;
  }

  const { data: failed } =
    await supabaseAdmin
      .from("user_videos")
      .select("*")
      .eq("user_id", userId)
      .eq(
        "video_url",
        failedMarker
      )
      .maybeSingle();

  return failed ?? null;
}

/*
|--------------------------------------------------------------------------
| OPENROUTER HEADERS
|--------------------------------------------------------------------------
*/

function openRouterHeaders() {
  if (!OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is missing."
    );
  }

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

/*
|--------------------------------------------------------------------------
| POST
|--------------------------------------------------------------------------
|
| Starts asynchronous Veo generation.
|
|--------------------------------------------------------------------------
*/

export async function POST(
  request: NextRequest
) {
  try {
    if (!OPENROUTER_API_KEY) {
      return json(
        {
          error:
            "OPENROUTER_API_KEY is not configured on the server.",
        },
        500
      );
    }

    if (!supabaseAdmin) {
      return json(
        {
          error:
            "Supabase server configuration is not configured.",
        },
        500
      );
    }

    /*
     * Authenticate user.
     */

    const user =
      await authenticateUser(request);

    if (!user) {
      return json(
        {
          error:
            "You must be signed in to generate a video.",
        },
        401
      );
    }

    /*
     * Read multipart form.
     */

    const formData =
      await request.formData();

    const promptValue =
      formData.get("prompt");

    const imageValue =
      formData.get("image");

    const durationValue =
      formData.get("duration");

    const withAudioValue =
      formData.get("withAudio");

    /*
     * Validate prompt.
     */

    if (
      typeof promptValue !== "string" ||
      !promptValue.trim()
    ) {
      return json(
        {
          error:
            "Please provide a script.",
        },
        400
      );
    }

    const prompt =
      promptValue.trim();

    if (prompt.length > 2000) {
      return json(
        {
          error:
            "Your script is too long. Please keep it under 2000 characters.",
        },
        400
      );
    }

    /*
     * Validate image.
     */

    if (!(imageValue instanceof File)) {
      return json(
        {
          error:
            "Please upload an image.",
        },
        400
      );
    }

    if (!imageValue.type.startsWith("image/")) {
      return json(
        {
          error:
            "The uploaded file must be an image.",
        },
        400
      );
    }

    if (
      imageValue.size >
      10 * 1024 * 1024
    ) {
      return json(
        {
          error:
            "Image must be smaller than 10MB.",
        },
        400
      );
    }

    /*
     * Validate duration.
     */

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
            "Invalid duration. Choose 4, 6, or 8 seconds.",
        },
        400
      );
    }

    const duration =
      parsedDuration as SupportedDuration;

    /*
     * Audio.
     */

    const withAudio =
      String(withAudioValue)
        .toLowerCase() ===
      "true";

    /*
     * Server-side pricing.
     */

    const cost =
      withAudio
        ? PRICING[duration].audio
        : PRICING[duration].silent;

    /*
     * Check credits before starting provider job.
     */

    const currentCredits =
      await getUserCredits(user.id);

    if (currentCredits < cost) {
      return json(
        {
          error:
            `You need ${cost} credits, but you only have ${currentCredits}.`,
          requiredCredits: cost,
          remainingCredits:
            currentCredits,
        },
        402
      );
    }

    /*
     * Upload image.
     */

    const imageUrl =
      await uploadInputImage(
        imageValue,
        user.id
      );

    /*
     * Build Veo prompt.
     */

    const veoPrompt =
      buildVeoPrompt(
        prompt,
        withAudio
      );

    /*
     * ------------------------------------------------------
     * OPENROUTER VIDEO REQUEST
     * ------------------------------------------------------
     *
     * IMPORTANT FIX:
     *
     * frame_images MUST be an ARRAY.
     *
     * Correct:
     *
     * frame_images: [
     *   {
     *     type: "image_url",
     *     image_url: {
     *       url: imageUrl
     *     },
     *     frame_type: "first_frame"
     *   }
     * ]
     *
     * This fixes:
     *
     * "Invalid input: expected array,
     *  received object"
     * ------------------------------------------------------
     */

    const openRouterResponse =
      await fetch(
        `${OPENROUTER_BASE_URL}/videos`,
        {
          method: "POST",

          headers:
            openRouterHeaders(),

          body: JSON.stringify({
            model: VIDEO_MODEL,

            prompt: veoPrompt,

            duration,

            resolution: "720p",

            aspect_ratio: "9:16",

            generate_audio:
              withAudio,

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

          cache: "no-store",
        }
      );

    const openRouterData =
      await openRouterResponse
        .json()
        .catch(() => null);

    /*
     * Provider rejected request.
     */

    if (!openRouterResponse.ok) {
      console.error(
        "OpenRouter generation error:",
        openRouterData
      );

      const providerError =
        openRouterData?.error;

      let errorMessage =
        "OpenRouter could not start the video generation.";

      if (
        typeof providerError ===
        "string"
      ) {
        errorMessage =
          providerError;
      } else if (
        providerError?.message
      ) {
        errorMessage =
          providerError.message;
      }

      return json(
        {
          error: errorMessage,
          providerStatus:
            openRouterResponse.status,
        },
        502
      );
    }

    /*
     * Get OpenRouter job ID.
     */

    const jobId =
      openRouterData?.id;

    if (!jobId) {
      console.error(
        "OpenRouter response did not contain a job ID:",
        openRouterData
      );

      return json(
        {
          error:
            "OpenRouter returned an unexpected response without a job ID.",
        },
        502
      );
    }

    /*
     * Create database history record BEFORE charging.
     */

    try {
      await createPendingVideoRecord({
        userId: user.id,
        prompt,
        imageUrl,
        duration,
        cost,
        withAudio,
        jobId,
      });
    } catch (databaseError: any) {
      console.error(
        "Could not create pending video record:",
        databaseError
      );

      return json(
        {
          error:
            "The video job started, but VidForge could not save the job record. Please contact support before trying again.",
        },
        500
      );
    }

    /*
     * Deduct credits.
     */

    const creditResult =
      await deductCredits(
        user.id,
        cost
      );

    if (!creditResult.success) {
      /*
       * Provider job already exists.
       * Mark our history record as failed.
       */

      await supabaseAdmin
        .from("user_videos")
        .update({
          video_url:
            `failed:${jobId}`,
        })
        .eq("user_id", user.id)
        .eq(
          "video_url",
          `pending:${jobId}`
        );

      return json(
        {
          error:
            "Your credit balance changed before the generation could be charged. Please try again.",
          remainingCredits:
            creditResult.remainingCredits,
        },
        402
      );
    }

    /*
     * Return job information to frontend.
     */

    return json({
      success: true,

      jobId,

      status:
        openRouterData.status ||
        "pending",

      pollingUrl:
        `/api/generate-script-video?jobId=${encodeURIComponent(
          jobId
        )}`,

      duration,

      withAudio,

      cost,

      remainingCredits:
        creditResult.remainingCredits,
    });
  } catch (error: any) {
    console.error(
      "POST /api/generate-script-video error:",
      error
    );

    return json(
      {
        error:
          error?.message ||
          "Something went wrong while starting video generation.",
      },
      500
    );
  }
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
|
| TWO MODES:
|
| 1. Normal GET:
|    Poll OpenRouter job status.
|
| 2. ?download=true:
|    Stream completed MP4 through VidForge.
|
|--------------------------------------------------------------------------
*/

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

    if (!supabaseAdmin) {
      return json(
        {
          error:
            "Supabase server configuration is not configured.",
        },
        500
      );
    }

    /*
     * Authenticate.
     */

    const user =
      await authenticateUser(request);

    if (!user) {
      return json(
        {
          error:
            "Authentication required.",
        },
        401
      );
    }

    const { searchParams } =
      new URL(request.url);

    const jobId =
      searchParams.get("jobId");

    const download =
      searchParams.get("download") ===
      "true";

    if (!jobId) {
      return json(
        {
          error:
            "Missing jobId.",
        },
        400
      );
    }

    /*
     * Verify ownership.
     */

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
     * Poll OpenRouter.
     */

    const openRouterResponse =
      await fetch(
        `${OPENROUTER_BASE_URL}/videos/${encodeURIComponent(
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

    const openRouterData =
      await openRouterResponse
        .json()
        .catch(() => null);

    if (!openRouterResponse.ok) {
      console.error(
        "OpenRouter polling error:",
        openRouterData
      );

      return json(
        {
          error:
            openRouterData?.error?.message ||
            openRouterData?.error ||
            "Unable to check video status.",
        },
        502
      );
    }

    const status =
      openRouterData?.status ||
      "unknown";

    /*
     * ------------------------------------------------------
     * FAILED
     * ------------------------------------------------------
     */

    if (
      status === "failed" ||
      status === "cancelled" ||
      status === "expired"
    ) {
      await supabaseAdmin
        .from("user_videos")
        .update({
          video_url:
            `failed:${jobId}`,
        })
        .eq("user_id", user.id)
        .eq(
          "video_url",
          `pending:${jobId}`
        );

      const currentCredits =
        await getUserCredits(
          user.id
        );

      return json({
        success: false,

        status,

        error:
          openRouterData?.error ||
          "The video generation failed.",

        remainingCredits:
          currentCredits,
      });
    }

    /*
     * ------------------------------------------------------
     * STILL PROCESSING
     * ------------------------------------------------------
     */

    if (
      status !== "completed"
    ) {
      const currentCredits =
        await getUserCredits(
          user.id
        );

      return json({
        success: true,

        status,

        jobId,

        remainingCredits:
          currentCredits,
      });
    }

    /*
     * ------------------------------------------------------
     * COMPLETED
     * ------------------------------------------------------
     */

    const unsignedUrls =
      Array.isArray(
        openRouterData?.unsigned_urls
      )
        ? openRouterData.unsigned_urls
        : [];

    const contentUrl =
      unsignedUrls[0];

    const fallbackUrl =
      openRouterData?.video_url ||
      openRouterData?.output?.video ||
      openRouterData?.output?.url ||
      null;

    const providerVideoUrl =
      contentUrl ||
      fallbackUrl;

    if (!providerVideoUrl) {
      console.error(
        "Completed OpenRouter job has no video URL:",
        openRouterData
      );

      return json(
        {
          error:
            "Veo completed the generation, but OpenRouter did not return a video URL.",
        },
        502
      );
    }

    /*
     * Protected VidForge video URL.
     */

    const appVideoUrl =
      `/api/generate-script-video?jobId=${encodeURIComponent(
        jobId
      )}&download=true`;

    /*
     * Save completed video URL.
     *
     * IMPORTANT:
     * image_url remains untouched.
     *
     * Therefore History continues to have both:
     *
     * image_url
     * video_url
     */

    await updateVideoRecord(
      user.id,
      jobId,
      appVideoUrl
    );

    /*
     * Normal status poll.
     */

    if (!download) {
      const currentCredits =
        await getUserCredits(
          user.id
        );

      return json({
        success: true,

        status: "completed",

        jobId,

        videoUrl:
          appVideoUrl,

        remainingCredits:
          currentCredits,
      });
    }

    /*
     * ------------------------------------------------------
     * DOWNLOAD / STREAM MODE
     * ------------------------------------------------------
     */

    const providerResponse =
      await fetch(
        providerVideoUrl,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${OPENROUTER_API_KEY}`,
          },

          cache: "no-store",
        }
      );

    if (!providerResponse.ok) {
      const providerText =
        await providerResponse
          .text()
          .catch(() => "");

      console.error(
        "Unable to download generated video from OpenRouter:",
        providerResponse.status,
        providerText
      );

      return json(
        {
          error:
            "The video was generated, but VidForge could not retrieve the finished MP4 yet.",
        },
        502
      );
    }

    const contentType =
      providerResponse.headers.get(
        "content-type"
      ) ||
      "video/mp4";

    const contentLength =
      providerResponse.headers.get(
        "content-length"
      );

    return new Response(
      providerResponse.body,
      {
        status: 200,

        headers: {
          "Content-Type":
            contentType,

          ...(contentLength
            ? {
                "Content-Length":
                  contentLength,
              }
            : {}),

          "Cache-Control":
            "private, no-store, max-age=0",

          "Content-Disposition":
            'inline; filename="vidforge-ai-video.mp4"',
        },
      }
    );
  } catch (error: any) {
    console.error(
      "GET /api/generate-script-video error:",
      error
    );

    return json(
      {
        error:
          error?.message ||
          "Something went wrong while checking your video.",
      },
      500
    );
  }
}