'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Image as ImageIcon, Music, Clock } from 'lucide-react';
import AppNavbar from '@/components/AppNavbar';

export default function PhotoToMusicPage() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [credits, setCredits] = useState(0);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      
      const { data } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();
      setCredits(data?.credits ?? 0);
      setLoadingUser(false);
    };
    init();
  }, [supabase, router]);

  if (loadingUser) {
    return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={user} />
      
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex justify-between items-center">
            <span>Your Balance: <strong className="text-emerald-400 text-lg">{credits}</strong> credits</span>
            <a href="/top-up" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium">Top Up</a>
          </div>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-violet-500/20 mb-4">
              <ImageIcon size={32} className="text-violet-400" />
              <Music size={20} className="text-violet-400 -ml-1" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Photo + Music → Video</h1>
            <p className="text-zinc-400">Upload an image, add your music, create a stunning video</p>
          </div>

          {/* PLACEHOLDER — Coming Soon */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-10 text-center">
            <Clock size={48} className="mx-auto text-zinc-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Coming Soon</h2>
            <p className="text-zinc-400 mb-6">This feature is being built. For now, try Photo + Script → Video instead!</p>
            <button 
              onClick={() => router.push('/generate/script')}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-medium transition"
            >
              Try Script Generator →
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}