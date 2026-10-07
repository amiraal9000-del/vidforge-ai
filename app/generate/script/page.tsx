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
  4: { audio: 40, silent: 25 },
  6: { audio: 60, silent: 40 },
  8: { audio: 80, silent: 50 },
};

const DURATIONS: Duration[] = [4, 6, 8];

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

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function estimateSpeechSeconds(wordCount: number) {
  if (!wordCount) return 0;

  return Math.ceil((wordCount / 150) * 60);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ScriptGeneratorPage() {
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState(0);

  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");

  const [duration, setDuration] = useState<Duration>(8);
  const [withAudio, setWithAudio] = useState(true);

  const [showReview, setShowReview] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [generationStatus, setGenerationStatus] =
    useState("");

  const [jobId, setJobId] = useState("");

  const [videoUrl, setVideoUrl] = useState("");
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState("");

  const pollingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const parsedDialogue = useMemo(
    () => extractQuotedDialogue(prompt),
    [prompt]
  );

  const spokenText = parsedDialogue.spokenText;

  const spokenWordCount = useMemo(
    () => countWords(spokenText),
    [spokenText]
  );

  const estimatedSeconds = useMemo(
    () => estimateSpeechSeconds(spokenWordCount),
    [spokenWordCount]
  );

  const unmatchedQuotation =
    parsedDialogue.hasUnmatchedQuote;

  const scriptTooLong =
    withAudio &&
    spokenWordCount > 0 &&
    estimatedSeconds > duration;

  const missingSpokenDialogue =
    withAudio &&
    prompt.trim().length > 0 &&
    spokenWordCount === 0;

  const quotationError =
    prompt.trim().length > 0 &&
    unmatchedQuotation;

  const currentCost =
    withAudio
      ? PRICING[duration].audio
      : PRICING[duration].silent;

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setUser(user);

      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", user.id)
          .maybeSingle();

        if (mounted) {
          setCredits(Number(data?.credits ?? 0));
        }
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || "";
  }

  function handleImageChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowed.includes(file.type)) {
      toast.error(
        "Please upload a PNG, JPG, or WebP image."
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller.");
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(file);
    setImagePreview(URL.createObjectURL(file));

    setVideoUrl("");
    setVideoReady(false);
    setVideoError("");
  }

  function validateBeforeReview() {
    if (!user) {
      toast.error("Please sign in first.");
      return false;
    }

    if (!image) {
      toast.error("Please upload an image.");
      return false;
    }

    if (!prompt.trim()) {
      toast.error("Please enter your script.");
      return false;
    }

    if (quotationError) {
      toast.error(
        "Please close the quotation mark around your spoken dialogue."
      );
      return false;
    }

    if (withAudio && missingSpokenDialogue) {
      toast.error(
        "Put the words you want spoken inside quotation marks."
      );
      return false;
    }

    if (scriptTooLong) {
      toast.error(
        `Your spoken dialogue is about ${estimatedSeconds}s, but the video is only ${duration}s.`
      );
      return false;
    }

    if (credits < currentCost) {
      toast.error(
        `You need ${currentCost} credits, but you only have ${credits}.`
      );
      return false;
    }

    return true;
  }

  function openReview() {
    if (!validateBeforeReview()) return;

    setShowReview(true);
  }

  async function startGeneration() {
    if (!validateBeforeReview()) return;

    if (!image) return;

    setShowReview(false);
    setGenerating(true);
    setVideoReady(false);
    setVideoError("");
    setVideoUrl("");
    setJobId("");
    pollingRef.current = true;

    try {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("Your login session has expired.");
      }

      const formData = new FormData();

      formData.append("prompt", prompt);
      formData.append("spokenText", spokenText);
      formData.append("image", image);
      formData.append("duration", String(duration));
      formData.append("withAudio", String(withAudio));

      setGenerationStatus(
        "Uploading your image and sending the video request..."
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

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
            data?.details ||
            "Video generation request failed."
        );
      }

      if (!data?.jobId) {
        throw new Error(
          "OpenRouter accepted the request but no job ID was returned."
        );
      }

      setJobId(data.jobId);

      if (
        typeof data.remainingCredits === "number"
      ) {
        setCredits(data.remainingCredits);
      }

      setGenerationStatus(
        "Video is being generated. Please wait..."
      );

      await pollVideo(data.jobId, token);
    } catch (error) {
      console.error(
        "[VidForge frontend] Generation error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Video generation failed.";

      setVideoError(message);
      setGenerationStatus("");
      toast.error(message);
      setGenerating(false);
      pollingRef.current = false;
    }
  }

  async function pollVideo(
    currentJobId: string,
    token: string
  ) {
    for (let attempt = 0; attempt < 72; attempt++) {
      if (!pollingRef.current) return;

      await sleep(5000);

      if (!pollingRef.current) return;

      try {
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

        const data = await response
          .json()
          .catch(() => ({}));

        console.log(
          "[VidForge frontend] Poll response:",
          data
        );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              data?.details ||
              "Could not check video status."
          );
        }

        if (
          typeof data.remainingCredits === "number"
        ) {
          setCredits(data.remainingCredits);
        }

        if (
          data.status === "pending" ||
          data.status === "in_progress"
        ) {
          setGenerationStatus(
            "Your video is still being generated..."
          );
          continue;
        }

        if (data.status === "failed") {
          throw new Error(
            data?.error ||
              "OpenRouter reported that video generation failed."
          );
        }

        if (
          data.status === "completed" &&
          data.videoUrl
        ) {
          setGenerationStatus(
            "Video generated successfully!"
          );

          setVideoUrl(data.videoUrl);
          setVideoReady(true);
          setGenerating(false);
          pollingRef.current = false;

          toast.success("Your video is ready!");

          setTimeout(() => {
            videoRef.current?.load();
            videoRef.current?.play().catch(() => {});
          }, 300);

          return;
        }
      } catch (error) {
        console.error(
          "[VidForge frontend] Polling error:",
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : "Video generation failed.";

        setVideoError(message);
        setGenerationStatus("");
        setGenerating(false);
        pollingRef.current = false;

        toast.error(message);
        return;
      }
    }

    setVideoError(
      "The video is taking longer than expected. Please check My Videos shortly."
    );

    setGenerationStatus("");
    setGenerating(false);
    pollingRef.current = false;
  }

  /*
   * DOWNLOAD
   *
   * This intentionally uses the same simple direct-link behavior
   * as the working My Videos / History page.
   *
   * We do NOT fetch the MP4 ourselves.
   * We do NOT create a Blob.
   * We do NOT create a temporary object URL.
   * We do NOT open our own fallback window.
   *
   * The browser receives the actual saved MP4 URL directly.
   */
  function goToMyVideos() {
    window.location.href = "/history";
  }

  function resetGenerator() {
    pollingRef.current = false;

    setGenerating(false);
    setGenerationStatus("");
    setJobId("");
    setVideoUrl("");
    setVideoReady(false);
    setVideoError("");
    setShowReview(false);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <AppNavbar user={user} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Create Video
          </h1>

          <p className="mt-2 text-white/60">
            Turn one photo into a video with VidForge AI.
          </p>

          <div className="mt-4 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm">
            Credits:{" "}
            <span className="ml-1 font-semibold">
              {credits}
            </span>
          </div>
        </div>

        {videoReady && videoUrl ? (
          <section className="mb-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            {/* SUCCESS HEADER */}
            <div className="rounded-xl border border-green-500/20 bg-green-500/[0.06] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-lg">
                  ✓
                </div>

                <div>
                  <h2 className="text-xl font-semibold">
                    Your video is ready! 🎉
                  </h2>

                  <p className="mt-1 text-sm text-white/60">
                    Your {duration}-second video has been
                    generated and saved successfully.
                  </p>

                  <p className="mt-2 text-sm text-white/70">
                    You can watch it here, download it, or
                    find it anytime in{" "}
                    <strong>My Videos</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* VIDEO */}
            <div className="mt-5">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="mx-auto max-h-[700px] w-full rounded-xl bg-black"
                onError={() => {
                  setVideoError(
                    "The generated video URL could not be played."
                  );
                }}
              />
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-white/90"
              >
                <span className="text-lg">↓</span>
                Download Video
              </a>

              <button
                type="button"
                onClick={goToMyVideos}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-5 py-4 font-semibold transition hover:bg-white/10"
              >
                <span className="text-lg">→</span>
                Go to My Videos
              </button>
            </div>

            {/* DOWNLOAD HELP */}
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-medium">
                Downloading your video
              </div>

              <p className="mt-1 text-xs leading-5 text-white/45">
                Tap <span className="text-white/70">Download Video</span>{" "}
                to open the saved MP4. Your browser/device will
                handle the download or saving option available to you.
              </p>
            </div>

            {videoError && (
              <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {videoError}
              </div>
            )}

            {/* SECONDARY ACTION */}
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                onClick={resetGenerator}
                className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Create another video
              </button>
            </div>

            {/* MY VIDEOS CALLOUT */}
            <button
              type="button"
              onClick={goToMyVideos}
              className="mt-5 flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:bg-white/[0.06]"
            >
              <div>
                <div className="text-sm font-semibold">
                  Your video is saved
                </div>

                <div className="mt-1 text-xs text-white/40">
                  Open My Videos to see all your generated
                  videos.
                </div>
              </div>

              <div className="text-xl text-white/60">
                →
              </div>
            </button>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Reference image
              </label>

              <label className="flex min-h-[220px] cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/20">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Reference preview"
                    className="max-h-[400px] w-auto max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-white/50">
                    <div className="text-lg">
                      Upload an image
                    </div>

                    <div className="mt-1 text-sm">
                      PNG, JPG or WebP · Max 10MB
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Script
              </label>

              <textarea
                value={prompt}
                onChange={(e) =>
                  setPrompt(e.target.value)
                }
                rows={10}
                placeholder={`Example:

A confident First Lady stands in an elegant setting, looks directly into the camera, and smiles warmly.

She says, "Turn one photo into a video with VidForge AI. Create yours today at VidForgeAI.com.ng."

The camera slowly moves closer with realistic cinematic lighting.`}
                className="w-full rounded-xl border border-white/10 bg-black/30 p-4 text-sm outline-none placeholder:text-white/30 focus:border-white/30"
              />

              <div className="mt-2 text-xs text-white/40">
                Put spoken words inside quotation marks.
              </div>

              {withAudio && spokenText && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                    Detected spoken dialogue
                  </div>

                  <div className="text-sm text-white/80">
                    “{spokenText}”
                  </div>

                  <div className="mt-2 text-xs text-white/40">
                    {spokenWordCount} words · approximately{" "}
                    {estimatedSeconds}s
                  </div>
                </div>
              )}

              {quotationError && (
                <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                  Your quotation marks are not balanced.
                </div>
              )}

              {scriptTooLong && (
                <div className="mt-3 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-300">
                  Your spoken dialogue is approximately{" "}
                  {estimatedSeconds}s, which is longer than
                  the selected {duration}s video.
                </div>
              )}

              {withAudio && missingSpokenDialogue && (
                <div className="mt-3 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-300">
                  Put the words you want the person to say
                  inside quotation marks.
                </div>
              )}
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium">
                Duration
              </label>

              <div className="grid grid-cols-3 gap-3">
                {DURATIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setDuration(value)
                    }
                    className={`rounded-xl border p-4 text-center transition ${
                      duration === value
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-black/20 text-white hover:bg-white/10"
                    }`}
                  >
                    <div className="font-semibold">
                      {value}s
                    </div>

                    <div className="mt-1 text-xs opacity-60">
                      {withAudio
                        ? PRICING[value].audio
                        : PRICING[value].silent}{" "}
                      credits
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4">
              <div>
                <div className="font-medium">
                  AI Audio
                </div>

                <div className="mt-1 text-xs text-white/40">
                  Generate realistic spoken dialogue.
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setWithAudio((value) => !value)
                }
                className={`relative h-7 w-12 rounded-full transition ${
                  withAudio
                    ? "bg-white"
                    : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full transition ${
                    withAudio
                      ? "left-6 bg-black"
                      : "left-1 bg-white"
                  }`}
                />
              </button>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">
                  Generation cost
                </span>

                <span className="font-semibold">
                  {currentCost} credits
                </span>
              </div>
            </div>

            {generationStatus && (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                <div className="font-medium">
                  {generationStatus}
                </div>

                {jobId && (
                  <div className="mt-2 break-all text-xs text-white/30">
                    Job: {jobId}
                  </div>
                )}
              </div>
            )}

            {videoError && !videoReady && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="text-sm font-semibold text-red-300">
                  Generation error
                </div>

                <div className="mt-2 break-words text-sm text-red-200/80">
                  {videoError}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={
                generating ||
                !image ||
                !prompt.trim() ||
                quotationError ||
                missingSpokenDialogue ||
                scriptTooLong ||
                credits < currentCost
              }
              onClick={openReview}
              className="w-full rounded-xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating
                ? "Generating..."
                : `Review & Create · ${currentCost} credits`}
            </button>
          </div>
        </section>
      </main>

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-neutral-950 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold">
                Review your video
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Check everything before generating.
              </p>
            </div>

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Reference"
                className="mx-auto mb-5 max-h-[300px] rounded-xl object-contain"
              />
            )}

            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Full script
                </div>

                <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/80">
                  {prompt}
                </div>
              </div>

              {withAudio && (
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                    Spoken dialogue
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                    “{spokenText}”
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-white/[0.03] p-3">
                  <div className="text-white/40">
                    Duration
                  </div>

                  <div className="mt-1 font-semibold">
                    {duration}s
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3">
                  <div className="text-white/40">
                    Audio
                  </div>

                  <div className="mt-1 font-semibold">
                    {withAudio ? "On" : "Off"}
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.03] p-3">
                  <div className="text-white/40">
                    Cost
                  </div>

                  <div className="mt-1 font-semibold">
                    {currentCost}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowReview(false)
                }
                className="flex-1 rounded-xl border border-white/10 px-5 py-3 font-medium hover:bg-white/10"
              >
                Go Back
              </button>

              <button
                type="button"
                disabled={
                  generating ||
                  quotationError ||
                  missingSpokenDialogue ||
                  scriptTooLong
                }
                onClick={startGeneration}
                className="flex-1 rounded-xl bg-white px-5 py-3 font-semibold text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating
                  ? "Generating..."
                  : "Create Video"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}