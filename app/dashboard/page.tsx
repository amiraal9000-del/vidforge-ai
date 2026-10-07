'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Video, Image, FileText, Clock } from 'lucide-react';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);
      
      const { data } = await supabase.from('profiles').select('credits').eq('id', user.id).single();
      setCredits(data?.credits ?? 0);
      setLoading(false);
    };
    checkUser();
  }, [supabase, router]);

  if (loading) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={user} />
      
      <main className="flex-1 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome, {user.email?.split('@')[0]} 👋</h1>
              <p className="text-zinc-400">What would you like to create today?</p>
            </div>
            <div className="flex items-center gap-3 bg-zinc-900 p-3 rounded-xl border border-zinc-800">
              <span className="text-zinc-400">Balance:</span>
              <span className="text-emerald-400 font-bold text-lg">{credits}</span>
              <a href="/top-up" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium">Top Up</a>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <Link href="/generate/music" className="group p-6 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-violet-500 transition-all">
              <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                <Image size={24} className="text-violet-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Photo + Music → Video</h3>
              <p className="text-zinc-400 text-sm">Upload an image, add music, generate a music video</p>
            </Link>

            <Link href="/generate/script" className="group p-6 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-fuchsia-500 transition-all">
              <div className="w-12 h-12 rounded-lg bg-fuchsia-500/20 flex items-center justify-center mb-4">
                <FileText size={24} className="text-fuchsia-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Photo + Script → Video</h3>
              <p className="text-zinc-400 text-sm">Write your story, pair with a photo, create a short film</p>
            </Link>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Clock size={20} /> Your Recent Videos
            </h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center text-zinc-400">
              <Video size={40} className="mx-auto mb-3 opacity-50" />
              <p>No videos created yet</p>
              <p className="text-sm mt-1">Start your first project above!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}