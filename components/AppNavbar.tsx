'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Menu, X, Music, FileText, User, LogOut } from 'lucide-react';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AppNavbar({ user }: { user: any }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="border-b border-zinc-800 px-4 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link href="/dashboard" className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
          VidForge AI
        </Link>

        {/* DESKTOP — Full links visible */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/dashboard" className="text-zinc-300 hover:text-white">Dashboard</Link>
          <Link href="/generate/music" className="text-zinc-300 hover:text-white">Photo + Music</Link>
          <Link href="/generate/script" className="text-zinc-300 hover:text-white">Photo + Script</Link>
          <Link href="/history" className="text-zinc-300 hover:text-white">My Videos</Link>
          <div className="flex items-center gap-2 text-zinc-300">
            <User size={16} />
            <span className="text-sm">{user.email?.split('@')[0]}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            Sign Out
          </button>
        </div>

        {/* MOBILE — One single hamburger dropdown */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden text-zinc-300 hover:text-white p-2"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Dropdown — ONE menu, everything inside */}
      {menuOpen && (
        <div className="md:hidden max-w-7xl mx-auto mt-2">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-800 border-b border-zinc-800"
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link
              href="/generate/music"
              className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-800 border-b border-zinc-800"
              onClick={() => setMenuOpen(false)}
            >
              <Music size={18} /> Photo + Music → Video
            </Link>
            <Link
              href="/generate/script"
              className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-800 border-b border-zinc-800"
              onClick={() => setMenuOpen(false)}
            >
              <FileText size={18} /> Photo + Script → Video
            </Link>
            <Link
              href="/history"
              className="flex items-center gap-3 px-5 py-4 hover:bg-zinc-800 border-b border-zinc-800"
              onClick={() => setMenuOpen(false)}
            >
              My Videos
            </Link>
            <div className="px-5 py-3 border-b border-zinc-800 text-sm text-zinc-500">
              {user.email}
            </div>
            <button
              onClick={() => { handleLogout(); setMenuOpen(false); }}
              className="flex items-center gap-3 w-full px-5 py-4 hover:bg-zinc-800 text-red-400 text-left"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}