"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import AppNavbar from "@/components/AppNavbar";

type Duration = 4 | 6 | 8;

type Pricing = {
  audio: number;
  silent: number;
};

const PRICING: Record<Duration, Pricing> = {
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
};

const DURATIONS: Duration[] = [4, 6, 8];

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms)
  );
}

/*
|--------------------------------------------------------------------------
| SCRIPT / SPEECH PARSER
|--------------------------------------------------------------------------
|
| ONLY text inside quotation marks is treated as spoken dialogue.
|
| Supported:
|
| "Hello there."
|
| “Hello there.”
|
| Multiple quoted sections are supported.
|
| Everything outside quotation marks remains part of the
| full visual / acting / camera prompt.
|
*/

function extractQuotedDialogue(text: string): {
  spokenText: string;
  hasUnmatchedQuote: boolean;
} {
  const segments: string[] = [];

  let straightOpen = false;
  let curlyOpen = false;

  let currentStraight = "";
  let currentCurly = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    /*
     * Straight quotation mark
     */
    if (char === '"') {
      if (straightOpen) {
        if (currentStraight.trim()) {
          segments.push(
            currentStraight.trim()
          );
        }

        currentStraight = "";
        straightOpen = false;
      } else {
        straightOpen = true;
        currentStraight = "";
      }

      continue;
    }

    /*
     * Curly opening quotation mark
     */
    if (char === "“") {
      if (!curlyOpen) {
        curlyOpen = true;
        currentCurly = "";
      }

      continue;
    }

    /*
     * Curly closing quotation mark
     */
    if (char === "”") {
      if (curlyOpen) {
        if (currentCurly.trim()) {
          segments.push(
            currentCurly.trim()
          );
        }

        currentCurly = "";
        curlyOpen = false;
      }

      continue;
    }

    /*
     * Collect text inside straight quotes.
     */
    if (straightOpen) {
      currentStraight += char;
    }

    /*
     * Collect text inside curly quotes.
     */
    if (curlyOpen) {
      currentCurly += char;
    }
  }

  return {
    spokenText:
      segments.join(" ").trim(),

    hasUnmatchedQuote:
      straightOpen || curlyOpen,
  };
}

function countWords(text: string): number {
  if (!text.trim()) {
    return 0;
  }

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

function estimateSpeechSeconds(
  spokenText: string
): number {
  const words =
    countWords(spokenText);

  if (words === 0) {
    return 0;
  }

  /*
   * Approximate natural speech:
   * 150 words per minute.
   */
  return Math.ceil(
    (words / 150) * 60
  );
}

export default function GenerateScriptVideoPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env
          .NEXT_PUBLIC_SUPABASE_URL!,
        process.env
          .NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  /*
  |--------------------------------------------------------------------------
  | USER
  |--------------------------------------------------------------------------
  */

  const [user, setUser] =
    useState<any>(null);

  const [credits, setCredits] =
    useState<number | null>(null);

  /*
  |--------------------------------------------------------------------------
  | GENERATOR INPUT
  |--------------------------------------------------------------------------
  */

  const [prompt, setPrompt] =
    useState("");

  const [image, setImage] =
    useState<File | null>(null);

  const [imagePreview, setImagePreview] =
    useState<string | null>(null);

  const [duration, setDuration] =
    useState<Duration>(8);

  const [withAudio, setWithAudio] =
    useState(true);

  /*
  |--------------------------------------------------------------------------
  | UI STATE
  |--------------------------------------------------------------------------
  */

  const [showReview, setShowReview] =
    useState(false);

  const [generating, setGenerating] =
    useState(false);

  const [generationStatus, setGenerationStatus] =
    useState("");

  const [jobId, setJobId] =
    useState<string | null>(null);

  /*
  |--------------------------------------------------------------------------
  | FINAL VIDEO
  |--------------------------------------------------------------------------
  */

  const [videoUrl, setVideoUrl] =
    useState<string | null>(null);

  const [videoReady, setVideoReady] =
    useState(false);

  const [videoError, setVideoError] =
    useState(false);

  /*
  |--------------------------------------------------------------------------
  | REFS
  |--------------------------------------------------------------------------
  */

  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const videoObjectUrlRef =
    useRef<string | null>(null);

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  /*
  |--------------------------------------------------------------------------
  | PARSED SCRIPT DATA
  |--------------------------------------------------------------------------
  */

  const parsedDialogue = useMemo(
    () =>
      extractQuotedDialogue(
        prompt
      ),
    [prompt]
  );

  const spokenText =
    parsedDialogue.spokenText;

  const unmatchedQuotation =
    parsedDialogue.hasUnmatchedQuote;

  const totalWordCount =
    useMemo(
      () =>
        countWords(prompt),
      [prompt]
    );

  const spokenWordCount =
    useMemo(
      () =>
        countWords(
          spokenText
        ),
      [spokenText]
    );

  const estimatedSeconds =
    useMemo(
      () =>
        estimateSpeechSeconds(
          spokenText
        ),
      [spokenText]
    );

  /*
  |--------------------------------------------------------------------------
  | SCRIPT VALIDATION
  |--------------------------------------------------------------------------
  */

  const scriptTooLong =
    withAudio &&
    spokenWordCount > 0 &&
    estimatedSeconds > duration;

  const missingSpokenDialogue =
    withAudio &&
    prompt.trim().length > 0 &&
    spokenText.trim().length === 0;

  const quotationError =
    prompt.trim().length > 0 &&
    unmatchedQuotation;

  /*
  |--------------------------------------------------------------------------
  | LOAD USER
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    const loadUser =
      async () => {
        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!mounted) {
          return;
        }

        setUser(user);

        if (!user) {
          return;
        }

        const {
          data: profile,
          error,
        } =
          await supabase
            .from("profiles")
            .select("credits")
            .eq(
              "id",
              user.id
            )
            .single();

        if (!mounted) {
          return;
        }

        if (
          !error &&
          profile
        ) {
          setCredits(
            Number(
              profile.credits ??
                0
            )
          );
        }
      };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  /*
  |--------------------------------------------------------------------------
  | CLEANUP
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      if (
        videoObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          videoObjectUrlRef.current
        );

        videoObjectUrlRef.current =
          null;
      }

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }
    };
  }, [imagePreview]);

  /*
  |--------------------------------------------------------------------------
  | IMAGE
  |--------------------------------------------------------------------------
  */

  const handleImageChange = (
    file: File | null
  ) => {
    if (!file) {
      return;
    }

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      toast.error(
        "Please select a valid image."
      );
      return;
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      toast.error(
        "Image must be smaller than 10MB."
      );
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    setImage(file);

    setImagePreview(
      URL.createObjectURL(file)
    );
  };

  /*
  |--------------------------------------------------------------------------
  | PRICE
  |--------------------------------------------------------------------------
  */

  const currentCost =
    withAudio
      ? PRICING[duration].audio
      : PRICING[duration].silent;

  /*
  |--------------------------------------------------------------------------
  | ACCESS TOKEN
  |--------------------------------------------------------------------------
  */

  const getAccessToken =
    async () => {
      const {
        data: {
          session,
        },
      } =
        await supabase.auth.getSession();

      return (
        session?.access_token ??
        null
      );
    };

  /*
  |--------------------------------------------------------------------------
  | VALIDATION MESSAGE
  |--------------------------------------------------------------------------
  */

  const getScriptValidationMessage =
    () => {
      if (
        quotationError
      ) {
        return "Your quotation marks are not balanced. Close the spoken dialogue with a quotation mark.";
      }

      if (
        withAudio &&
        missingSpokenDialogue
      ) {
        return 'AI audio is ON. Put the words you want spoken inside quotation marks, for example: “Believe in yourself.”';
      }

      if (
        scriptTooLong
      ) {
        return `The spoken dialogue is too long for a ${duration}-second video. Shorten the words inside the quotation marks or choose a longer duration.`;
      }

      return "";
    };

  const scriptValidationMessage =
    getScriptValidationMessage();

  /*
  |--------------------------------------------------------------------------
  | REVIEW
  |--------------------------------------------------------------------------
  */

  const handleReview = () => {
    if (!user) {
      toast.error(
        "Please sign in first."
      );
      return;
    }

    if (!image) {
      toast.error(
        "Please upload a photo."
      );
      return;
    }

    if (!prompt.trim()) {
      toast.error(
        "Please enter your script."
      );
      return;
    }

    if (
      quotationError
    ) {
      toast.error(
        "Please close your quotation marks before continuing."
      );
      return;
    }

    if (
      withAudio &&
      missingSpokenDialogue
    ) {
      toast.error(
        "AI audio is ON. Put the words you want spoken inside quotation marks."
      );
      return;
    }

    if (scriptTooLong) {
      toast.error(
        `The spoken dialogue is too long for a ${duration}-second video.`
      );
      return;
    }

    if (
      credits !== null &&
      credits < currentCost
    ) {
      toast.error(
        `You need ${currentCost} credits to create this video.`
      );
      return;
    }

    setShowReview(true);
  };

  /*
  |--------------------------------------------------------------------------
  | START GENERATION
  |--------------------------------------------------------------------------
  */

  const startGeneration =
    async () => {
      if (!user) {
        toast.error(
          "Please sign in before generating."
        );
        return;
      }

      if (!image) {
        toast.error(
          "Please upload a photo."
        );
        return;
      }

      if (!prompt.trim()) {
        toast.error(
          "Please enter your script."
        );
        return;
      }

      if (
        quotationError
      ) {
        toast.error(
          "Please close your quotation marks before generating."
        );
        return;
      }

      if (
        withAudio &&
        missingSpokenDialogue
      ) {
        toast.error(
          "AI audio is ON. Put the words you want spoken inside quotation marks."
        );
        return;
      }

      if (scriptTooLong) {
        toast.error(
          `The spoken dialogue is too long for a ${duration}-second video.`
        );
        return;
      }

      if (
        credits !== null &&
        credits < currentCost
      ) {
        toast.error(
          `You need ${currentCost} credits to create this video.`
        );
        return;
      }

      const token =
        await getAccessToken();

      if (!token) {
        toast.error(
          "Your session has expired."
        );
        return;
      }

      try {
        /*
         * Reset previous preview.
         */

        if (
          videoObjectUrlRef.current
        ) {
          URL.revokeObjectURL(
            videoObjectUrlRef.current
          );

          videoObjectUrlRef.current =
            null;
        }

        setVideoUrl(null);
        setVideoReady(false);
        setVideoError(false);

        setGenerating(true);
        setShowReview(false);
        setJobId(null);

        setGenerationStatus(
          "Preparing your video..."
        );

        /*
         * Multipart request.
         */

        const formData =
          new FormData();

        /*
         * FULL SCRIPT
         *
         * Contains:
         * - scene direction
         * - camera direction
         * - acting direction
         * - spoken dialogue
         */

        formData.append(
          "prompt",
          prompt.trim()
        );

        /*
         * SPOKEN DIALOGUE
         *
         * Contains ONLY words inside
         * quotation marks.
         */

        formData.append(
          "spokenText",
          spokenText
        );

        formData.append(
          "image",
          image
        );

        formData.append(
          "duration",
          String(duration)
        );

        formData.append(
          "withAudio",
          String(withAudio)
        );

        setGenerationStatus(
          "Sending your idea to Veo..."
        );

        const response =
          await fetch(
            "/api/generate-script-video",
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,

              cache: "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => null
            );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to start video generation."
          );
        }

        if (!data?.jobId) {
          throw new Error(
            "No video generation job was returned."
          );
        }

        /*
         * Provider job started.
         */

        setJobId(
          data.jobId
        );

        if (
          typeof data.remainingCredits ===
          "number"
        ) {
          setCredits(
            data.remainingCredits
          );
        }

        setGenerationStatus(
          "Veo is creating your video..."
        );

        await pollForVideo(
          data.jobId
        );
      } catch (error: any) {
        console.error(
          "Generation error:",
          error
        );

        toast.error(
          error?.message ||
            "Something went wrong while generating your video."
        );

        setGenerationStatus(
          ""
        );

        setGenerating(
          false
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | POLL VIDEO
  |--------------------------------------------------------------------------
  */

  const pollForVideo =
    async (
      currentJobId: string
    ) => {
      /*
       * 72 attempts × 5 seconds = 6 minutes.
       */

      const maxAttempts = 72;

      for (
        let attempt = 0;
        attempt <
        maxAttempts;
        attempt++
      ) {
        const token =
          await getAccessToken();

        if (!token) {
          throw new Error(
            "Your session has expired."
          );
        }

        const response =
          await fetch(
            `/api/generate-script-video?jobId=${encodeURIComponent(
              currentJobId
            )}`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              cache: "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => null
            );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to check video status."
          );
        }

        /*
         * Keep credits synchronized.
         */

        if (
          typeof data?.remainingCredits ===
          "number"
        ) {
          setCredits(
            data.remainingCredits
          );
        }

        /*
         * FAILED
         */

        if (
          data?.status ===
            "failed" ||
          data?.status ===
            "cancelled" ||
          data?.status ===
            "expired"
        ) {
          throw new Error(
            data?.error ||
              `Video generation ${data.status}.`
          );
        }

        /*
         * COMPLETED
         */

        if (
          data?.status ===
          "completed"
        ) {
          if (!data.videoUrl) {
            throw new Error(
              "Veo completed the video, but no video URL was returned."
            );
          }

          setGenerationStatus(
            "Your video has been created!"
          );

          /*
           * Retrieve the actual MP4.
           */

          await downloadVideo(
            data.videoUrl
          );

          setGenerationStatus(
            "Your video is ready."
          );

          setGenerating(
            false
          );

          toast.success(
            "Your AI video is ready!"
          );

          return;
        }

        /*
         * PROCESSING
         */

        if (
          data?.status ===
          "pending"
        ) {
          setGenerationStatus(
            "Your video is queued..."
          );
        } else if (
          data?.status ===
          "in_progress"
        ) {
          setGenerationStatus(
            "Veo is generating your video..."
          );
        } else {
          setGenerationStatus(
            "Generating your video..."
          );
        }

        await sleep(5000);
      }

      throw new Error(
        "Video generation is taking longer than expected. Please try again."
      );
    };

  /*
  |--------------------------------------------------------------------------
  | DOWNLOAD FINISHED VIDEO
  |--------------------------------------------------------------------------
  */

  const downloadVideo =
    async (
      protectedVideoUrl: string
    ) => {
      const token =
        await getAccessToken();

      if (!token) {
        throw new Error(
          "Your session has expired."
        );
      }

      setGenerationStatus(
        "Preparing your finished video..."
      );

      const response =
        await fetch(
          protectedVideoUrl,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache: "no-store",
          }
        );

      if (!response.ok) {
        let errorMessage =
          "Unable to retrieve the generated video.";

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        if (
          contentType.includes(
            "application/json"
          )
        ) {
          const data =
            await response
              .json()
              .catch(
                () => null
              );

          if (data?.error) {
            errorMessage =
              data.error;
          }
        } else {
          const text =
            await response
              .text()
              .catch(
                () => ""
              );

          if (text) {
            errorMessage =
              text;
          }
        }

        throw new Error(
          errorMessage
        );
      }

      /*
       * Convert MP4 response into
       * browser object URL.
       */

      const blob =
        await response.blob();

      if (!blob.size) {
        throw new Error(
          "The generated video file is empty."
        );
      }

      if (
        !blob.type.startsWith(
          "video/"
        ) &&
        blob.type !==
          "application/octet-stream"
      ) {
        console.warn(
          "Unexpected generated video content type:",
          blob.type
        );
      }

      /*
       * Remove previous object URL.
       */

      if (
        videoObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          videoObjectUrlRef.current
        );

        videoObjectUrlRef.current =
          null;
      }

      /*
       * Create local browser URL.
       */

      const objectUrl =
        URL.createObjectURL(
          blob
        );

      videoObjectUrlRef.current =
        objectUrl;

      setVideoError(
        false
      );

      setVideoReady(
        false
      );

      setVideoUrl(
        objectUrl
      );

      /*
       * Give React time to mount video.
       */

      await new Promise<void>(
        (resolve) => {
          requestAnimationFrame(
            () => {
              resolve();
            }
          );
        }
      );

      /*
       * Try immediate playback.
       */

      if (
        videoRef.current
      ) {
        try {
          videoRef.current.load();

          await videoRef.current
            .play()
            .catch(() => {
              /*
               * Browser may block autoplay.
               */
            });
        } catch {
          /*
           * Ignore autoplay restrictions.
           */
        }
      }
    };

  /*
  |--------------------------------------------------------------------------
  | VIDEO READY
  |--------------------------------------------------------------------------
  */

  const handleVideoReady =
    () => {
      setVideoReady(
        true
      );

      setVideoError(
        false
      );
    };

  /*
  |--------------------------------------------------------------------------
  | VIDEO ERROR
  |--------------------------------------------------------------------------
  */

  const handleVideoError =
    () => {
      setVideoError(
        true
      );

      setVideoReady(
        false
      );

      console.error(
        "The browser could not play the generated video."
      );
    };

  /*
  |--------------------------------------------------------------------------
  | CREATE ANOTHER VIDEO
  |--------------------------------------------------------------------------
  */

  const startNewVideo =
    () => {
      if (
        videoObjectUrlRef.current
      ) {
        URL.revokeObjectURL(
          videoObjectUrlRef.current
        );

        videoObjectUrlRef.current =
          null;
      }

      if (imagePreview) {
        URL.revokeObjectURL(
          imagePreview
        );
      }

      setVideoUrl(
        null
      );

      setVideoReady(
        false
      );

      setVideoError(
        false
      );

      setJobId(
        null
      );

      setGenerationStatus(
        ""
      );

      setGenerating(
        false
      );

      setShowReview(
        false
      );

      setPrompt(
        ""
      );

      setImage(
        null
      );

      setImagePreview(
        null
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    };

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">

      {/* =====================================================
          NAVBAR
          ===================================================== */}

      <AppNavbar user={user} />

      {/* =====================================================
          MAIN
          ===================================================== */}

      <main className="flex-1">

        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

          {/* =================================================
              HEADER
              ================================================= */}

          <div className="mb-8">

            <div className="mb-2 flex items-center gap-2">

              <div className="h-2 w-2 rounded-full bg-purple-500" />

            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Create a video
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
              Turn a photo and your script into an
              AI-generated video with realistic
              movement, expressions and speech.
            </p>

          </div>

          {/* =================================================
              COMPLETED VIDEO
              ================================================= */}

          {videoUrl && (

            <div className="mb-8 overflow-hidden rounded-3xl border border-green-500/20 bg-white/[0.04] shadow-2xl">

              <div className="p-5 sm:p-7">

                <div className="mb-6 text-center">

                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">

                    <span className="text-2xl text-green-400">
                      ✓
                    </span>

                  </div>

                  <h2 className="text-2xl font-bold sm:text-3xl">
                    Your video has been created!
                  </h2>

                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/50">
                    Your AI-generated video is ready.
                    You can watch it below or create
                    another video.
                  </p>

                </div>

                <div className="mx-auto w-full max-w-md">

                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">

                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      autoPlay
                      playsInline
                      loop
                      preload="auto"
                      onLoadedData={
                        handleVideoReady
                      }
                      onCanPlay={
                        handleVideoReady
                      }
                      onError={
                        handleVideoError
                      }
                      className="block h-auto w-full bg-black"
                    />

                    {!videoReady &&
                      !videoError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">

                          <div className="text-center">

                            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-purple-400" />

                            <p className="text-xs text-white/60">
                              Preparing video...
                            </p>

                          </div>

                        </div>
                      )}

                  </div>

                  {videoError && (

                    <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-center">

                      <p className="text-sm font-semibold text-red-300">
                        The video was created, but
                        your browser could not play it.
                      </p>

                      <p className="mt-2 text-xs leading-5 text-red-300/60">
                        Please try opening the video
                        again or refresh the page.
                      </p>

                    </div>

                  )}

                </div>

                <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">

                  <button
                    type="button"
                    onClick={
                      startNewVideo
                    }
                    className="rounded-2xl bg-white px-6 py-3.5 text-sm font-bold text-black transition hover:bg-white/90"
                  >
                    Create another video
                  </button>

                </div>

              </div>

            </div>

          )}

          {/* =================================================
              GENERATOR
              ================================================= */}

          {!videoUrl && (

            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

              {/* =============================================
                  LEFT
                  ============================================= */}

              <div className="space-y-6">

                {/* PHOTO */}

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">

                  <div className="mb-5">

                    <div className="flex items-center gap-3">

                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-sm font-bold text-purple-300">
                        1
                      </div>

                      <h2 className="text-lg font-semibold">
                        Upload your photo
                      </h2>

                    </div>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Use a clear photo of the person
                      or character you want to animate.
                    </p>

                  </div>

                  <input
                    ref={
                      fileInputRef
                    }
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(
                      event
                    ) => {
                      const file =
                        event.target.files?.[0] ||
                        null;

                      handleImageChange(
                        file
                      );
                    }}
                  />

                  {imagePreview ? (

                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">

                      <img
                        src={
                          imagePreview
                        }
                        alt="Selected reference"
                        className="mx-auto max-h-[430px] w-full object-contain"
                      />

                      <button
                        type="button"
                        disabled={
                          generating
                        }
                        onClick={() =>
                          fileInputRef.current?.click()
                        }
                        className="absolute bottom-3 right-3 rounded-xl bg-black/80 px-4 py-2 text-xs font-semibold backdrop-blur transition hover:bg-black disabled:opacity-50"
                      >
                        Change photo
                      </button>

                    </div>

                  ) : (

                    <button
                      type="button"
                      disabled={
                        generating
                      }
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="flex min-h-[270px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 px-6 text-center transition hover:border-purple-400/50 hover:bg-purple-500/[0.04] disabled:opacity-50"
                    >

                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl text-purple-300">
                        +
                      </div>

                      <span className="text-sm font-semibold">
                        Upload photo
                      </span>

                      <span className="mt-2 text-xs text-white/40">
                        PNG, JPG or WebP • Max 10MB
                      </span>

                    </button>

                  )}

                </section>

                {/* SCRIPT */}

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">

                  <div className="mb-5">

                    <div className="flex items-center gap-3">

                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-sm font-bold text-purple-300">
                        2
                      </div>

                      <h2 className="text-lg font-semibold">
                        Write your script
                      </h2>

                    </div>

                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Describe the scene, movement and
                      performance normally. Put only the
                      words you want the character to speak
                      inside quotation marks.
                    </p>

                  </div>

                  {/* SPEECH INSTRUCTION */}

                  <div className="mb-4 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] px-4 py-3">

                    <p className="text-xs font-semibold text-purple-200">
                      💡 How speech works
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/50">
                      Put spoken words inside{" "}
                      <span className="font-semibold text-white/80">
                        “quotation marks”
                      </span>
                      . Everything outside the
                      quotation marks is treated as
                      scene, acting or camera direction.
                    </p>

                  </div>

                  <textarea
                    value={
                      prompt
                    }
                    onChange={(
                      event
                    ) =>
                      setPrompt(
                        event.target.value
                      )
                    }
                    disabled={
                      generating
                    }
                    rows={9}
                    placeholder={`Example:

A confident woman looks directly into the camera and smiles warmly. The camera slowly moves closer while she gestures naturally. She says, “Believe in yourself. Your next level starts with one decision.” Cinematic lighting, realistic movement, professional social-media video.`}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-purple-400/50 disabled:opacity-50"
                  />

                  {/* SCRIPT STATS */}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">

                    <span className="text-white/40">
                      {totalWordCount} total words
                    </span>

                    <div className="flex flex-wrap items-center gap-3">

                      <span className="text-purple-300/80">
                        {spokenWordCount} spoken words
                      </span>

                      {prompt.trim() && (
                        <span
                          className={
                            scriptTooLong
                              ? "text-red-400"
                              : "text-green-400"
                          }
                        >
                          Estimated speech:
                          {" "}
                          ~{estimatedSeconds}s
                        </span>
                      )}

                    </div>

                  </div>

                  {/* QUOTATION ERROR */}

                  {quotationError && (

                    <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-xs leading-5 text-yellow-300">

                      <strong>
                        Quotation marks are not balanced.
                      </strong>{" "}
                      Make sure every spoken section has
                      both an opening and closing quotation
                      mark.

                    </div>

                  )}

                  {/* NO SPOKEN DIALOGUE */}

                  {missingSpokenDialogue &&
                    !quotationError && (

                      <div className="mt-4 rounded-xl border border-purple-500/20 bg-purple-500/10 px-4 py-3 text-xs leading-5 text-purple-200">

                        AI audio is ON. Put the words
                        you want the character to speak
                        inside quotation marks, for example:
                        {" "}
                        <strong>
                          “Believe in yourself.”
                        </strong>

                      </div>

                    )}

                  {/* TOO LONG */}

                  {scriptTooLong && (

                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-300">

                      The spoken dialogue is too long
                      for a {duration}-second video.
                      Shorten the words inside the
                      quotation marks or choose a
                      longer duration.

                    </div>

                  )}

                  {/* SILENT MODE INFO */}

                  {!withAudio &&
                    prompt.trim() &&
                    spokenWordCount === 0 &&
                    !quotationError && (

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-white/40">

                        Silent mode is enabled. You can
                        describe the character's actions,
                        camera movement and scene without
                        adding spoken dialogue.

                      </div>

                    )}

                </section>

              </div>

              {/* =============================================
                  RIGHT
                  ============================================= */}

              <div className="space-y-6">

                {/* SETTINGS */}

                <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">

                  <div className="flex items-center gap-3">

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-sm font-bold text-purple-300">
                      3
                    </div>

                    <h2 className="text-lg font-semibold">
                      Video settings
                    </h2>

                  </div>

                  {/* DURATION */}

                  <div className="mt-6">

                    <label className="text-sm font-medium text-white/80">
                      Duration
                    </label>

                    <div className="mt-3 grid grid-cols-3 gap-2">

                      {DURATIONS.map(
                        (value) => (

                          <button
                            key={
                              value
                            }
                            type="button"
                            disabled={
                              generating
                            }
                            onClick={() =>
                              setDuration(
                                value
                              )
                            }
                            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              duration ===
                              value
                                ? "border-purple-400 bg-purple-500/15 text-white"
                                : "border-white/10 bg-black/20 text-white/60 hover:border-white/20 hover:text-white"
                            } disabled:opacity-50`}
                          >
                            {value}s
                          </button>

                        )
                      )}

                    </div>

                  </div>

                  {/* AUDIO */}

                  <div className="mt-7">

                    <div className="flex items-center justify-between gap-4">

                      <div>

                        <p className="text-sm font-medium">
                          AI-generated audio
                        </p>

                        <p className="mt-1 text-xs leading-5 text-white/40">
                          Generate synchronized speech
                          and natural sound from the
                          quoted dialogue.
                        </p>

                      </div>

                      <button
                        type="button"
                        disabled={
                          generating
                        }
                        onClick={() =>
                          setWithAudio(
                            (
                              current
                            ) =>
                              !current
                          )
                        }
                        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                          withAudio
                            ? "bg-purple-500"
                            : "bg-white/15"
                        }`}
                        aria-label="Toggle AI audio"
                      >

                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                            withAudio
                              ? "left-6"
                              : "left-1"
                          }`}
                        />

                      </button>

                    </div>

                  </div>

                  {/* CREDITS */}

                  <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-4">

                    <div className="flex items-center justify-between">

                      <span className="text-sm text-white/50">
                        Cost
                      </span>

                      <span className="text-lg font-bold">
                        {currentCost}
                        {" "}
                        credits
                      </span>

                    </div>

                    {credits !== null && (

                      <div className="mt-2 flex items-center justify-between text-xs">

                        <span className="text-white/40">
                          Your balance
                        </span>

                        <span
                          className={
                            credits >=
                            currentCost
                              ? "text-green-400"
                              : "text-red-400"
                          }
                        >
                          {credits} credits
                        </span>

                      </div>

                    )}

                  </div>

                </section>

                {/* GENERATE */}

                <section className="rounded-3xl border border-purple-500/20 bg-purple-500/[0.05] p-5 sm:p-6">

                  {generating ? (

                    <div className="py-3 text-center">

                      <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-purple-400" />

                      <p className="text-sm font-semibold">
                        Creating your video
                      </p>

                      <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-white/50">
                        {generationStatus ||
                          "AI is working on your video..."}
                      </p>

                      {jobId && (

                        <p className="mt-4 break-all text-[10px] text-white/20">
                          Job: {jobId}
                        </p>

                      )}

                    </div>

                  ) : (

                    <>

                      <button
                        type="button"
                        onClick={
                          handleReview
                        }
                        disabled={
                          !image ||
                          !prompt.trim() ||
                          quotationError ||
                          missingSpokenDialogue ||
                          scriptTooLong ||
                          (credits !== null &&
                            credits <
                              currentCost)
                        }
                        className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Review & Create Video
                      </button>

                      {scriptValidationMessage && (

                        <p className="mt-3 text-center text-[11px] leading-5 text-red-300/80">
                          {scriptValidationMessage}
                        </p>

                      )}

                      <p className="mt-3 text-center text-[11px] leading-5 text-white/35">
                        Your image and script will be
                        securely processed by VidForge AI.
                      </p>

                    </>

                  )}

                </section>

              </div>

            </div>

          )}

        </div>

      </main>

      {/* =====================================================
          REVIEW MODAL
          ===================================================== */}

      {showReview &&
        !generating &&
        !videoUrl && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">

            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#101010] shadow-2xl">

              <div className="p-5 sm:p-6">

                <div className="mb-6">

                  <h2 className="text-xl font-bold">
                    Review your video
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Check everything before we send
                    your request to Veo.
                  </p>

                </div>

                {/* IMAGE */}

                {imagePreview && (

                  <div className="overflow-hidden rounded-2xl bg-black">

                    <img
                      src={
                        imagePreview
                      }
                      alt="Video reference"
                      className="max-h-[280px] w-full object-contain"
                    />

                  </div>

                )}

                {/* SCRIPT */}

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/30">
                    Full script
                  </p>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-white/80">
                    {prompt}
                  </p>

                </div>

                {/* SPOKEN DIALOGUE */}

                <div className="mt-4 rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-purple-300/70">
                    Spoken dialogue
                  </p>

                  {spokenText ? (

                    <p className="text-sm leading-6 text-white/90">
                      “{spokenText}”
                    </p>

                  ) : (

                    <p className="text-sm leading-6 text-white/40">
                      No spoken dialogue.
                    </p>

                  )}

                  <p className="mt-2 text-xs text-white/35">
                    {spokenWordCount} spoken words
                    {" • "}
                    {withAudio
                      ? `~${estimatedSeconds}s estimated speech`
                      : "Audio off"}
                  </p>

                </div>

                {/* SETTINGS */}

                <div className="mt-4 grid grid-cols-2 gap-3">

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">

                    <p className="text-xs text-white/30">
                      Duration
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {duration} seconds
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">

                    <p className="text-xs text-white/30">
                      Audio
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {withAudio
                        ? "AI audio"
                        : "Silent"}
                    </p>

                  </div>

                </div>

                {/* COST */}

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">

                  <span className="text-sm text-white/60">
                    Total
                  </span>

                  <span className="font-bold">
                    {currentCost}
                    {" "}
                    credits
                  </span>

                </div>

                {/* BUTTONS */}

                <div className="mt-6 grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      setShowReview(
                        false
                      )
                    }
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-semibold transition hover:bg-white/[0.08]"
                  >
                    Go back
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowReview(
                        false
                      );

                      startGeneration();
                    }}
                    disabled={
                      quotationError ||
                      missingSpokenDialogue ||
                      scriptTooLong ||
                      !image ||
                      !prompt.trim() ||
                      (credits !== null &&
                        credits <
                          currentCost)
                    }
                    className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Create Video
                  </button>

                </div>

              </div>

            </div>

          </div>

        )}

    </div>
  );
}