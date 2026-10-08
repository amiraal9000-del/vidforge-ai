"use client";

import { useEffect, useMemo, useState } from "react";

type Generation = {
  id: string;
  user_id: string;
  email: string;
  prompt: string;
  image_url: string | null;
  video_url: string;
  duration: number;
  cost: number;
  has_audio: boolean;
  created_at: string;
};

type Summary = {
  totalGenerations: number;
  totalCreditsSpent: number;
  audioGenerations: number;
  silentGenerations: number;
  duration4: number;
  duration6: number;
  duration8: number;
};

export default function AdminGenerationsPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalGenerations: 0,
    totalCreditsSpent: 0,
    audioGenerations: 0,
    silentGenerations: 0,
    duration4: 0,
    duration6: 0,
    duration8: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadGenerations();
  }, []);

  async function loadGenerations() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/generations", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load generations");
      }

      setGenerations(data.generations || []);
      setSummary(
        data.summary || {
          totalGenerations: 0,
          totalCreditsSpent: 0,
          audioGenerations: 0,
          silentGenerations: 0,
          duration4: 0,
          duration6: 0,
          duration8: 0,
        }
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load generations"
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredGenerations = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return generations;

    return generations.filter((generation) => {
      return (
        generation.email.toLowerCase().includes(query) ||
        generation.prompt.toLowerCase().includes(query) ||
        generation.id.toLowerCase().includes(query)
      );
    });
  }, [generations, search]);

  function formatDate(date: string) {
    if (!date) return "—";

    return new Date(date).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  function formatPrompt(prompt: string) {
    if (!prompt) return "No script";

    if (prompt.length <= 90) return prompt;

    return `${prompt.slice(0, 90)}...`;
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Generations
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Monitor every video generated through VidForge AI.
            </p>
          </div>

          <button
            onClick={loadGenerations}
            disabled={loading}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Generations"
            value={summary.totalGenerations.toLocaleString()}
            description="Videos generated"
          />

          <StatCard
            title="Credits Spent"
            value={summary.totalCreditsSpent.toLocaleString()}
            description="Credits consumed"
          />

          <StatCard
            title="AI Audio"
            value={summary.audioGenerations.toLocaleString()}
            description="With generated audio"
          />

          <StatCard
            title="Silent"
            value={summary.silentGenerations.toLocaleString()}
            description="Without audio"
          />
        </div>

        {/* Duration breakdown */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DurationCard
            duration={4}
            count={summary.duration4}
          />

          <DurationCard
            duration={6}
            count={summary.duration6}
          />

          <DurationCard
            duration={8}
            count={summary.duration8}
          />
        </div>

        {/* Search */}
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Generated Videos
              </h2>

              <p className="text-sm text-slate-400">
                {filteredGenerations.length.toLocaleString()} result
                {filteredGenerations.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="w-full sm:max-w-sm">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search email, script or ID..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            Loading generations...
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filteredGenerations.length === 0 && (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-10 text-center">
            <div className="text-3xl">🎬</div>

            <h3 className="mt-3 font-semibold">
              No generations found
            </h3>

            <p className="mt-1 text-sm text-slate-400">
              {search
                ? "Try a different search."
                : "Generated videos will appear here."}
            </p>
          </div>
        )}

        {/* Desktop table */}
        {!loading && filteredGenerations.length > 0 && (
          <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead className="border-b border-slate-800 bg-slate-950/60">
                  <tr className="text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-4 font-medium">
                      User
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Script
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Duration
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Audio
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Credits
                    </th>

                    <th className="px-5 py-4 font-medium">
                      Created
                    </th>

                    <th className="px-5 py-4 text-right font-medium">
                      Video
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800">
                  {filteredGenerations.map((generation) => (
                    <tr
                      key={generation.id}
                      className="transition hover:bg-slate-800/30"
                    >
                      <td className="px-5 py-4">
                        <div className="max-w-[220px] truncate text-sm font-medium text-white">
                          {generation.email}
                        </div>

                        <div className="mt-1 max-w-[220px] truncate text-xs text-slate-500">
                          {generation.id}
                        </div>
                      </td>

                      <td className="max-w-[350px] px-5 py-4">
                        <div
                          className="text-sm text-slate-300"
                          title={generation.prompt}
                        >
                          {formatPrompt(generation.prompt)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200">
                          {generation.duration}s
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                            generation.has_audio
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {generation.has_audio
                            ? "AI Audio"
                            : "Silent"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-white">
                          {Number(
                            generation.cost || 0
                          ).toLocaleString()}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-400">
                        {formatDate(generation.created_at)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <a
                          href={generation.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile cards */}
        {!loading && filteredGenerations.length > 0 && (
          <div className="mt-4 space-y-3 lg:hidden">
            {filteredGenerations.map((generation) => (
              <div
                key={generation.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {generation.email}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {generation.id}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                    {generation.duration}s
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-slate-950/70 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Script
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    {formatPrompt(generation.prompt)}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      Audio
                    </p>

                    <p className="mt-1 text-sm font-medium text-white">
                      {generation.has_audio
                        ? "AI Audio"
                        : "Silent"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      Credits
                    </p>

                    <p className="mt-1 text-sm font-medium text-white">
                      {Number(
                        generation.cost || 0
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    {formatDate(generation.created_at)}
                  </p>

                  <a
                    href={generation.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-700"
                  >
                    View Video
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <p className="mt-2 text-2xl font-bold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </div>
  );
}

function DurationCard({
  duration,
  count,
}: {
  duration: number;
  count: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">
          {duration}-second videos
        </span>

        <span className="text-lg font-bold text-white">
          {count.toLocaleString()}
        </span>
      </div>
    </div>
  );
}