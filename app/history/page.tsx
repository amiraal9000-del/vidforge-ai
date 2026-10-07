'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Video, Calendar, Clock, Download, Trash2 } from 'lucide-react';
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
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return router.push('/login');
      setUser(currentUser);

      const { data, error } = await supabase
        .from('user_videos')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (!error && data) setVideos(data);
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
    if (!error) setVideos(prev => prev.filter(v => v.id !== id));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
          <button onClick={() => router.push('/dashboard')} 
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <div className="flex items-center gap-3 mb-8">
            <Video size={28} className="text-violet-400" />
            <h1 className="text-2xl font-bold">Your Generated Videos</h1>
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-16 bg-zinc-900 rounded-xl border border-zinc-800">
              <Video size={48} className="mx-auto text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium mb-2">No videos yet</h3>
              <p className="text-zinc-400 mb-6">Your generated videos will appear here</p>
              <button onClick={() => router.push('/create')}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium">
                Create Your First Video
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {videos.map((video) => (
                <div key={video.id} 
                  className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 hover:border-zinc-700 transition">
                  <div className="flex flex-col sm:flex-row gap-4">
                    {/* Video Preview */}
                    <div className="w-full sm:w-48 flex-shrink-0 rounded-lg overflow-hidden bg-black">
                      <video src={video.video_url} controls preload="metadata"
                        className="w-full h-32 object-cover" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300 line-clamp-2 mb-3">
                        {video.prompt || 'No description'}
                      </p>
                      
                      <div className="flex flex-wrap gap-4 text-xs text-zinc-500 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {formatDate(video.created_at)}
                        </span>
                        {video.duration && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {video.duration}s
                          </span>
                        )}
                        {video.cost && (
                          <span className="text-emerald-400">
                            {video.cost} Credits
                          </span>
                        )}
                        {video.has_audio && (
                          <span className="text-violet-400">🔊 With Audio</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <a href={video.video_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition">
                          <Download size={14} /> Download
                        </a>
                        <button onClick={() => handleDelete(video.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-900/30 hover:bg-red-800/40 text-red-400 rounded-lg text-sm transition">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}