'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ChevronDown, User, LogOut, Music, FileText } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AppNavbar({ user }: { user: any }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
          VidForge AI
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-zinc-300 hover:text-white">Dashboard</Link>

          <div className="relative">
            <button
              onClick={() => setCreateOpen(!createOpen)}
              className="flex items-center gap-1 text-zinc-300 hover:text-white"
            >
              Create <ChevronDown size={16} className={`transition-transform ${createOpen ? 'rotate-180' : ''}`} />
            </button>
            {createOpen && (
              <div className="absolute top-full left-0 mt-2 w-60 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
                <Link
                  href="/generate/music"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-t-lg"
                  onClick={() => setCreateOpen(false)}
                >
                  <Music size={18} /> Photo + Music → Video
                </Link>
                <Link
                  href="/generate/script"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-b-lg"
                  onClick={() => setCreateOpen(false)}
                >
                  <FileText size={18} /> Photo + Script → Video
                </Link>
              </div>
            )}
          </div>

          <Link href="/history" className="text-zinc-300 hover:text-white">My Videos</Link>

          <div className="relative">
            <button
              onClick={() => setAccountOpen(!accountOpen)}
              className="flex items-center gap-2 text-zinc-300 hover:text-white"
            >
              <User size={18} /> Account <ChevronDown size={16} className={`transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>
            {accountOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-50">
                <div className="px-4 py-3 border-b border-zinc-800 text-sm text-zinc-400">
                  {user.email}
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-zinc-800 text-red-400 rounded-b-lg text-left"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}