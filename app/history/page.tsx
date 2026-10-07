'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Video,
  Calendar,
  Clock,
  Download,
  Trash2,
  Share2,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

type VideoRecord = {
  id: string;
  prompt: string | null;
  image_url: string | null;
  video_url: string;
  duration: number | null;
  cost: number | null;
  has_audio: boolean | null;
  created_at: string;
};

export default function HistoryPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      const { data, error } = await supabase
        .from('user_videos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setVideos(data);
      }

      setLoading(false);
    };

    init();
  }, [supabase, router]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video from your history?')) return;

    const { error } = await supabase
      .from('user_videos')
      .delete()
      .eq('id', id);

    if (!error) {
      setVideos((prev) => prev.filter((v) => v.id !== id));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  /**
   * Save / download video.
   *
   * On supported phones, this uses the native share sheet with
   * the actual video file. On iPhone, the user can choose
   * "Save to Files" or another available destination.
   *
   * On desktop / browsers that don't support file sharing,
   * it falls back to a normal download.
   */
  const handleDownload = async (video: VideoRecord) => {
    if (!video.video_url) return;

    setDownloadingId(video.id);
    setSavedId(null);

    try {
      const response = await fetch(video.video_url);

      if (!response.ok) {
        throw new Error('Could not retrieve video');
      }

      const blob = await response.blob();

      const fileName = `VidForge-AI-${video.id}.mp4`;

      const file = new File([blob], fileName, {
        type: 'video/mp4',
      });

      // Use native share/save sheet where supported.
      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: 'VidForge AI Video',
          text: 'My video created with VidForge AI',
        });

        setSavedId(video.id);
        return;
      }

      // Desktop / browser fallback.
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);

      setSavedId(video.id);
    } catch (error: any) {
      console.error('Video save error:', error);

      /*
       * If the native share sheet was cancelled, don't show an error.
       * The user simply backed out of the share/save menu.
       */
      if (
        error?.name === 'AbortError' ||
        error?.message?.toLowerCase()?.includes('cancel')
      ) {
        return;
      }

      /*
       * Last-resort fallback:
       * open the video directly so the user can use the browser's
       * own Share / Save controls.
       */
      window.open(video.video_url, '_blank');

      alert(
        'The video was opened because your browser does not support direct saving here. Use the Share button or browser menu to save the video to your device.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * Optional direct sharing action.
   */
  const handleShare = async (video: VideoRecord) => {
    if (!video.video_url) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'VidForge AI Video',
          text: 'Check out my video created with VidForge AI.',
          url: video.video_url,
        });
      } else {
        await navigator.clipboard.writeText(video.video_url);
        alert('Video link copied to clipboard.');
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;

      console.error('Share error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={user} />

      <main className="flex-1 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Back */}
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Video size={28} className="text-violet-400" />

            <div>
              <h1 className="text-2xl font-bold">
                Your Generated Videos
              </h1>

              <p className="text-sm text-zinc-500 mt-1">
                Your videos are saved here.
              </p>
            </div>
          </div>

          {/* Empty */}
          {videos.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900 rounded-xl border border-zinc-800">
              <Video
                size={48}
                className="mx-auto text-zinc-600 mb-4"
              />

              <h3 className="text-lg font-medium mb-2">
                No videos yet
              </h3>

              <p className="text-zinc-400 mb-6">
                Your generated videos will appear here
              </p>

              <button
                onClick={() => router.push('/create')}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium transition"
              >
                Create Your First Video
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {videos.map((video) => {
                const isDownloading = downloadingId === video.id;
                const isSaved = savedId === video.id;

                return (
                  <div
                    key={video.id}
                    className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition"
                  >
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Video Preview */}
                      <div className="w-full sm:w-48 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                        <video
                          src={video.video_url}
                          controls
                          preload="metadata"
                          playsInline
                          className="w-full h-32 object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-300 line-clamp-2 mb-3">
                          {video.prompt || 'No description'}
                        </p>

                        {/* Metadata */}
                        <div className="flex flex-wrap gap-4 text-xs text-zinc-500 mb-4">
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            {formatDate(video.created_at)}
                          </span>

                          {video.duration && (
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {video.duration}s
                            </span>
                          )}

                          {video.cost !== null && (
                            <span className="text-emerald-400">
                              {video.cost} Credits
                            </span>
                          )}

                          {video.has_audio && (
                            <span className="text-violet-400">
                              🔊 With Audio
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {/* MAIN SAVE BUTTON */}
                          <button
                            onClick={() => handleDownload(video)}
                            disabled={isDownloading}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:text-violet-400 rounded-lg text-sm font-medium transition"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2
                                  size={15}
                                  className="animate-spin"
                                />
                                Preparing...
                              </>
                            ) : isSaved ? (
                              <>
                                <CheckCircle size={15} />
                                Saved
                              </>
                            ) : (
                              <>
                                <Download size={15} />
                                Save Video
                              </>
                            )}
                          </button>

                          {/* SHARE */}
                          <button
                            onClick={() => handleShare(video)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition"
                          >
                            <Share2 size={15} />
                            Share
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() => handleDelete(video.id)}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-800/40 text-red-400 rounded-lg text-sm transition"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>

                        {/* Mobile save explanation */}
                        <p className="text-xs text-zinc-500 mt-3">
                          On iPhone or Android, tap{' '}
                          <span className="text-zinc-300">
                            Save Video
                          </span>{' '}
                          and choose where you want to save or share it.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}