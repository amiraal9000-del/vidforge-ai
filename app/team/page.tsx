import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';
import { User } from 'lucide-react';

export default function TeamPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-violet-400 hover:underline text-sm mb-8 inline-block">
            ← Back
          </Link>

          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
            The Team
          </h1>

          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 text-violet-400">Founder & Creator</h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                <User size={24} className="text-violet-400" />
              </div>
              <div>
                <h3 className="font-semibold">Zuriedge</h3>
                <p className="text-zinc-400 text-sm">Founder & Developer</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-4 text-fuchsia-400">Next Phase</h2>
            <p className="text-zinc-400 mb-4">
              Following acquisition, the new owner will assemble and announce the full leadership team that will guide VidForge AI forward.
            </p>
            <div className="space-y-3">
              {['CEO', 'CTO', 'Head of Product', 'Lead Engineer', 'Marketing Lead'].map((role, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 border-dashed rounded-lg p-3">
                  <p className="text-zinc-300 font-medium">{role}</p>
                  <p className="text-zinc-500 text-xs">To be announced by new ownership</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER — Matches All Pages */}
      <footer className="border-t border-zinc-900 py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-bold text-lg mb-3">VidForge AI</h3>
              <p className="text-zinc-400 text-sm">Turn ideas into videos instantly</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-sm">More</h4>
              <ul className="space-y-1 text-sm">
                <li><Link href="/about" className="text-zinc-400 hover:text-white">About</Link></li>
                <li><Link href="/" className="text-zinc-400 hover:text-white">Home</Link></li>
              </ul>
            </div>
          </div>
          <p className="text-zinc-500 text-sm text-center border-t border-zinc-900 pt-4">
            © 2026 VidForge AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}