"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function GenerateScriptVideoPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);

  const [prompt, setPrompt] = useState("");

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [duration, setDuration] = useState<Duration>(8);
  const [withAudio, setWithAudio] = useState(true);

  const [showReview, setShowReview] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");

  const [jobId, setJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoObjectUrlRef = useRef<string | null>(null);

  /*
  |--------------------------------------------------------------------------
  | USER
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(user);

      if (!user) return;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (!mounted) return;

      if (!error && profile) {
        setCredits(Number(profile.credits ?? 0));
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  /*
  |--------------------------------------------------------------------------
  | CLEANUP VIDEO OBJECT URL
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
      }
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | IMAGE
  |--------------------------------------------------------------------------
  */

  const handleImageChange = (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be smaller than 10MB.");
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  /*
  |--------------------------------------------------------------------------
  | PRICE
  |--------------------------------------------------------------------------
  */

  const currentCost = withAudio
    ? PRICING[duration].audio
    : PRICING[duration].silent;

  /*
  |--------------------------------------------------------------------------
  | SCRIPT LENGTH
  |--------------------------------------------------------------------------
  */

  const wordCount = prompt.trim()
    ? prompt.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const estimatedSeconds =
    wordCount > 0
      ? Math.ceil((wordCount / 150) * 60)
      : 0;

  const scriptTooLong =
    estimatedSeconds > duration;

  /*
  |--------------------------------------------------------------------------
  | TOKEN
  |--------------------------------------------------------------------------
  */

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  };

  /*
  |--------------------------------------------------------------------------
  | REVIEW
  |--------------------------------------------------------------------------
  */

  const handleReview = () => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    if (!image) {
      toast.error("Please upload a photo.");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Please enter your script.");
      return;
    }

    if (scriptTooLong) {
      toast.error(
        `Your script is too long for a ${duration}-second video.`
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

  const startGeneration = async () => {
    if (!user) {
      toast.error("Please sign in before generating.");
      return;
    }

    if (!image) {
      toast.error("Please upload a photo.");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Please enter your script.");
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      toast.error("Your session has expired.");
      return;
    }

    try {
      setGenerating(true);
      setShowReview(false);
      setVideoUrl(null);
      setJobId(null);
      setGenerationStatus("Preparing your video...");

      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
        videoObjectUrlRef.current = null;
      }

      const formData = new FormData();

      formData.append(
        "prompt",
        prompt.trim()
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

      /*
       * Do NOT send cost.
       *
       * Backend calculates it.
       */

      setGenerationStatus(
        "Sending your idea to Veo..."
      );

      const response = await fetch(
        "/api/generate-script-video",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data =
        await response
          .json()
          .catch(() => null);

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

      setJobId(data.jobId);

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

      setGenerationStatus("");
      setGenerating(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | POLL JOB
  |--------------------------------------------------------------------------
  */

  const pollForVideo = async (
    currentJobId: string
  ) => {
    const maxAttempts = 72;

    for (
      let attempt = 0;
      attempt < maxAttempts;
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
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to check video status."
        );
      }

      if (
        typeof data?.remainingCredits ===
        "number"
      ) {
        setCredits(
          data.remainingCredits
        );
      }

      if (
        data?.status ===
        "completed"
      ) {
        if (!data.videoUrl) {
          throw new Error(
            "Video completed but no video URL was returned."
          );
        }

        setGenerationStatus(
          "Video created. Preparing your preview..."
        );

        await downloadVideo(
          data.videoUrl
        );

        setGenerationStatus(
          "Your video is ready."
        );

        setGenerating(false);

        toast.success(
          "Your AI video is ready!"
        );

        return;
      }

      if (
        data?.status === "failed" ||
        data?.status === "cancelled" ||
        data?.status === "expired"
      ) {
        throw new Error(
          data?.error ||
            `Video generation ${data.status}.`
        );
      }

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
  | DOWNLOAD VIDEO
  |--------------------------------------------------------------------------
  */

  const downloadVideo = async (
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
      "Downloading your finished video..."
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
      const data =
        await response
          .json()
          .catch(() => null);

      throw new Error(
        data?.error ||
          "Unable to download the generated video."
      );
    }

    const blob =
      await response.blob();

    if (!blob.size) {
      throw new Error(
        "The generated video file is empty."
      );
    }

    if (
      videoObjectUrlRef.current
    ) {
      URL.revokeObjectURL(
        videoObjectUrlRef.current
      );
    }

    const objectUrl =
      URL.createObjectURL(blob);

    videoObjectUrlRef.current =
      objectUrl;

    setVideoUrl(objectUrl);
  };

  /*
  |--------------------------------------------------------------------------
  | NEW VIDEO
  |--------------------------------------------------------------------------
  */

  const startNewVideo = () => {
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

    setVideoUrl(null);
    setJobId(null);
    setGenerationStatus("");
    setGenerating(false);
    setShowReview(false);

    setPrompt("");
    setImage(null);
    setImagePreview(null);
  };

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">

      {/* =====================================================
          APP NAVBAR
          ===================================================== */}

      <AppNavbar user={user} />

      {/* =====================================================
          MAIN APP CONTENT
          ===================================================== */}

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

          {/* HEADER */}

          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />

              <span className="text-sm font-medium text-purple-300">
                VidForge AI
              </span>
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
              GENERATED VIDEO
              ================================================= */}

          {videoUrl && (
            <div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">

              <div className="p-5 sm:p-6">

                <div className="mb-5 flex items-center justify-between">

                  <div>
                    <p className="text-sm font-semibold text-green-400">
                      Video ready
                    </p>

                    <p className="mt-1 text-xs text-white/50">
                      Your AI-generated video has been
                      created successfully.
                    </p>
                  </div>

                </div>

                <div className="mx-auto max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl">

                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="block h-auto w-full"
                  />

                </div>

                <div className="mt-6 flex justify-center">

                  <button
                    type="button"
                    onClick={
                      startNewVideo
                    }
                    className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
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
                      or character you want Veo to animate.
                    </p>

                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
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
                        src={imagePreview}
                        alt="Selected reference"
                        className="mx-auto max-h-[430px] w-full object-contain"
                      />

                      <button
                        type="button"
                        disabled={generating}
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
                      disabled={generating}
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
                      Tell the character what to say and
                      describe how you want the performance
                      to feel.
                    </p>

                  </div>

                  <textarea
                    value={prompt}
                    onChange={(event) =>
                      setPrompt(
                        event.target.value
                      )
                    }
                    disabled={generating}
                    rows={8}
                    placeholder={`Example:

Look directly into the camera with confidence and say:

“Wait… you’re telling me this video was made from just ONE photo?”`}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-purple-400/50 disabled:opacity-50"
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">

                    <span className="text-white/40">
                      {wordCount} words
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

                  {scriptTooLong && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-300">
                      This script is too long for a{" "}
                      {duration}-second video.
                      Shorten it or choose a longer
                      duration.
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
                            key={value}
                            type="button"
                            disabled={generating}
                            onClick={() =>
                              setDuration(
                                value
                              )
                            }
                            className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                              duration === value
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
                          and natural sound.
                        </p>

                      </div>

                      <button
                        type="button"
                        disabled={generating}
                        onClick={() =>
                          setWithAudio(
                            (current) =>
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
                            credits >= currentCost
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
                          scriptTooLong ||
                          (credits !== null &&
                            credits <
                              currentCost)
                        }
                        className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Review & Create Video
                      </button>

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
                      src={imagePreview}
                      alt="Video reference"
                      className="max-h-[280px] w-full object-contain"
                    />

                  </div>
                )}

                {/* SCRIPT */}

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">

                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/30">
                    Script
                  </p>

                  <p className="whitespace-pre-wrap text-sm leading-6 text-white/80">
                    {prompt}
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
                      setShowReview(false)
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
                    className="rounded-2xl bg-white px-4 py-4 text-sm font-bold text-black transition hover:bg-white/90"
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