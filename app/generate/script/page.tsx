"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";

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

  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [duration, setDuration] = useState<Duration>(8);
  const [withAudio, setWithAudio] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const [showReview, setShowReview] = useState(false);

  const [credits, setCredits] = useState<number | null>(null);

  const [user, setUser] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const videoObjectUrlRef = useRef<string | null>(null);

  /*
   * ---------------------------------------------------------
   * LOAD USER
   * ---------------------------------------------------------
   */

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .single();

        if (profile) {
          setCredits(profile.credits ?? 0);
        }
      }
    };

    loadUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  /*
   * ---------------------------------------------------------
   * CLEANUP VIDEO OBJECT URL
   * ---------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
      }
    };
  }, []);

  /*
   * ---------------------------------------------------------
   * IMAGE HANDLING
   * ---------------------------------------------------------
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

    setImage(file);

    const preview = URL.createObjectURL(file);
    setImagePreview(preview);
  };

  /*
   * ---------------------------------------------------------
   * CURRENT PRICE
   * ---------------------------------------------------------
   */

  const currentCost = withAudio
    ? PRICING[duration].audio
    : PRICING[duration].silent;

  /*
   * ---------------------------------------------------------
   * SCRIPT LENGTH CHECK
   * ---------------------------------------------------------
   *
   * Approximate speaking speed:
   * ~150 words/minute
   */

  const wordCount = prompt.trim()
    ? prompt.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const estimatedSeconds =
    wordCount > 0 ? Math.ceil((wordCount / 150) * 60) : 0;

  const scriptTooLong = estimatedSeconds > duration;

  /*
   * ---------------------------------------------------------
   * GET AUTH TOKEN
   * ---------------------------------------------------------
   */

  const getAccessToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token ?? null;
  };

  /*
   * ---------------------------------------------------------
   * START GENERATION
   * ---------------------------------------------------------
   */

  const startGeneration = async () => {
    if (!user) {
      toast.error("Please sign in before generating a video.");
      return;
    }

    if (!image) {
      toast.error("Please upload a photo first.");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Please enter your script.");
      return;
    }

    if (scriptTooLong) {
      toast.error(
        `Your script is too long for a ${duration}-second video. Please shorten it.`
      );
      return;
    }

    const token = await getAccessToken();

    if (!token) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setGenerating(true);
      setGenerationStatus("Preparing your video...");
      setVideoUrl(null);
      setJobId(null);

      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
        videoObjectUrlRef.current = null;
      }

      const formData = new FormData();

      formData.append("prompt", prompt.trim());
      formData.append("image", image);
      formData.append("duration", String(duration));
      formData.append("withAudio", String(withAudio));

      /*
       * IMPORTANT:
       * We intentionally DO NOT send the cost.
       *
       * The backend calculates the real cost itself.
       */

      setGenerationStatus("Sending your idea to Veo...");

      const response = await fetch("/api/generate-script-video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to start video generation."
        );
      }

      if (!data?.jobId) {
        throw new Error("The video generation job was not created.");
      }

      setJobId(data.jobId);

      if (typeof data.remainingCredits === "number") {
        setCredits(data.remainingCredits);
      }

      setGenerationStatus(
        "Veo is creating your video. This can take a little while..."
      );

      await pollForVideo(data.jobId);
    } catch (error: any) {
      console.error("Video generation error:", error);

      toast.error(
        error?.message || "Something went wrong while generating your video."
      );

      setGenerationStatus("");
      setGenerating(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * POLL VEO JOB
   * ---------------------------------------------------------
   */

  const pollForVideo = async (currentJobId: string) => {
    const maxAttempts = 72;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your session has expired.");
      }

      const response = await fetch(
        `/api/generate-script-video?jobId=${encodeURIComponent(
          currentJobId
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to check video generation status."
        );
      }

      if (typeof data?.remainingCredits === "number") {
        setCredits(data.remainingCredits);
      }

      if (data?.status === "completed") {
        if (!data.videoUrl) {
          throw new Error(
            "Veo finished the video, but no video URL was returned."
          );
        }

        setGenerationStatus("Video created. Preparing your preview...");

        await downloadVideo(data.videoUrl);

        setGenerationStatus("Your video is ready.");
        setGenerating(false);

        toast.success("Your AI video is ready!");

        return;
      }

      if (
        data?.status === "failed" ||
        data?.status === "cancelled" ||
        data?.status === "expired"
      ) {
        throw new Error(
          data?.error ||
            `Video generation ${data.status}. Please try again.`
        );
      }

      /*
       * Status can be:
       * pending
       * in_progress
       */

      if (data?.status === "pending") {
        setGenerationStatus(
          "Your video is queued. Veo will start generating it shortly..."
        );
      } else if (data?.status === "in_progress") {
        setGenerationStatus(
          "Veo is generating your video now. Almost there..."
        );
      } else {
        setGenerationStatus("Generating your video...");
      }

      await sleep(5000);
    }

    throw new Error(
      "Video generation is taking longer than expected. Please try again shortly."
    );
  };

  /*
   * ---------------------------------------------------------
   * DOWNLOAD GENERATED VIDEO
   * ---------------------------------------------------------
   *
   * The backend protects the video endpoint with authentication.
   *
   * Therefore we fetch the MP4 ourselves and create a browser
   * object URL instead of placing the protected URL directly
   * inside <video src="">.
   */

  const downloadVideo = async (protectedVideoUrl: string) => {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("Your session has expired.");
    }

    setGenerationStatus("Downloading your finished video...");

    const response = await fetch(protectedVideoUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);

      throw new Error(
        data?.error || "Unable to download the generated video."
      );
    }

    const blob = await response.blob();

    if (!blob.size) {
      throw new Error("The generated video file was empty.");
    }

    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current);
    }

    const objectUrl = URL.createObjectURL(blob);

    videoObjectUrlRef.current = objectUrl;

    setVideoUrl(objectUrl);
  };

  /*
   * ---------------------------------------------------------
   * REVIEW
   * ---------------------------------------------------------
   */

  const handleReview = () => {
    if (!user) {
      toast.error("Please sign in first.");
      return;
    }

    if (!image) {
      toast.error("Please upload an image.");
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

    setShowReview(true);
  };

  /*
   * ---------------------------------------------------------
   * RESET
   * ---------------------------------------------------------
   */

  const startNewVideo = () => {
    if (videoObjectUrlRef.current) {
      URL.revokeObjectURL(videoObjectUrlRef.current);
      videoObjectUrlRef.current = null;
    }

    setVideoUrl(null);
    setJobId(null);
    setGenerationStatus("");
    setShowReview(false);
    setPrompt("");
    setImage(null);
    setImagePreview(null);
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* HEADER */}

        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500" />

            <span className="text-sm font-medium text-purple-300">
              VidForge AI
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Create a video from a photo + script
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
            Upload a photo, write what you want your character to say,
            and let AI turn it into a short video.
          </p>
        </div>

        {/* VIDEO READY */}

        {videoUrl && (
          <div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl">
            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-400">
                    Video ready
                  </p>

                  <p className="mt-1 text-xs text-white/50">
                    Your AI-generated video has been created successfully.
                  </p>
                </div>
              </div>

              <div className="mx-auto max-w-sm overflow-hidden rounded-2xl bg-black">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="block h-auto w-full"
                />
              </div>

              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={startNewVideo}
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                >
                  Create another video
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN GENERATOR */}

        {!videoUrl && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* LEFT */}

            <div className="space-y-6">
              {/* IMAGE */}

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">
                    1. Upload your photo
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    Use a clear photo of the person or character you want
                    Veo to animate.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    handleImageChange(file);
                  }}
                />

                {imagePreview ? (
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <img
                      src={imagePreview}
                      alt="Selected reference"
                      className="mx-auto max-h-[420px] w-full object-contain"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={generating}
                      className="absolute bottom-3 right-3 rounded-xl bg-black/80 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Change photo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={generating}
                    className="flex min-h-[260px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/20 px-6 text-center transition hover:border-purple-400/50 hover:bg-purple-500/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-2xl">
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
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">
                    2. Write your script
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    Tell the character exactly what you want them to say
                    and describe the performance naturally.
                  </p>
                </div>

                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  disabled={generating}
                  rows={7}
                  placeholder="Example: Look directly into the camera with confidence and say: “Wait… you’re telling me this video was made from just ONE photo?”"
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-purple-400/50 disabled:cursor-not-allowed disabled:opacity-50"
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
                      Estimated speech: ~{estimatedSeconds}s
                    </span>
                  )}
                </div>

                {scriptTooLong && (
                  <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs leading-5 text-red-300">
                    This script is too long for a {duration}-second
                    video. Shorten it or choose a longer duration.
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT */}

            <div className="space-y-6">
              {/* SETTINGS */}

              <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                <h2 className="text-lg font-semibold">
                  3. Video settings
                </h2>

                {/* DURATION */}

                <div className="mt-5">
                  <label className="text-sm font-medium text-white/80">
                    Duration
                  </label>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {DURATIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        disabled={generating}
                        onClick={() => setDuration(value)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                          duration === value
                            ? "border-purple-400 bg-purple-500/15 text-white"
                            : "border-white/10 bg-black/20 text-white/60 hover:border-white/20 hover:text-white"
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {value}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* AUDIO */}

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">
                        AI-generated audio
                      </p>

                      <p className="mt-1 text-xs leading-5 text-white/40">
                        Veo generates synchronized speech and sound when
                        enabled.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={generating}
                      onClick={() => setWithAudio((current) => !current)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                        withAudio ? "bg-purple-500" : "bg-white/15"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                      aria-label="Toggle AI audio"
                    >
                      <span
                        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                          withAudio ? "left-6" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* PRICE */}

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/50">
                      Generation cost
                    </span>

                    <span className="text-lg font-bold">
                      {currentCost} credits
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

              {/* ACTION */}

              <section className="rounded-3xl border border-purple-500/20 bg-purple-500/[0.05] p-5 sm:p-6">
                {generating ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-purple-400" />

                    <p className="text-sm font-semibold">
                      Creating your video
                    </p>

                    <p className="mt-2 text-xs leading-5 text-white/50">
                      {generationStatus ||
                        "AI is working on your video..."}
                    </p>

                    {jobId && (
                      <p className="mt-3 break-all text-[10px] text-white/20">
                        Job: {jobId}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleReview}
                      disabled={
                        !image ||
                        !prompt.trim() ||
                        scriptTooLong ||
                        credits !== null && credits < currentCost
                      }
                      className="w-full rounded-2xl bg-white px-5 py-4 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Review & Create Video
                    </button>

                    <p className="mt-3 text-center text-[11px] leading-5 text-white/35">
                      Your photo and script are sent securely to the
                      video generation service.
                    </p>
                  </>
                )}
              </section>
            </div>
          </div>
        )}

        {/* REVIEW MODAL */}

        {showReview && !generating && !videoUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#101010] shadow-2xl">
              <div className="p-5 sm:p-6">
                <div className="mb-6">
                  <h2 className="text-xl font-bold">
                    Review your video
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-white/50">
                    Everything looks good? Start the AI generation.
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
                      {withAudio ? "AI audio" : "Silent"}
                    </p>
                  </div>
                </div>

                {/* COST */}

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
                  <span className="text-sm text-white/60">
                    Total
                  </span>

                  <span className="font-bold">
                    {currentCost} credits
                  </span>
                </div>

                {/* BUTTONS */}

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReview(false)}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                  >
                    Go back
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowReview(false);
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
    </div>
  );
}