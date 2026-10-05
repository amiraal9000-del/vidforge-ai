import Link from 'next/link';

export default function PublicNavbar() {
  return (
    <nav className="border-b border-zinc-800 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
          VidForge AI
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-300 hover:text-white">Home</Link>
          <Link href="/login" className="px-4 py-2 text-zinc-300 hover:text-white">Sign In</Link>
          <Link href="/signup" className="px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg font-medium hover:opacity-90">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}