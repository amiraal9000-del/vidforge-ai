import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1 py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-violet-400 hover:underline text-sm mb-8 inline-block">
            ← Back
          </Link>

          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
            About VidForge AI
          </h1>

          <div className="space-y-6 text-lg">
            <section>
              <h2 className="text-xl font-semibold mb-2">What It Is</h2>
              <p className="text-zinc-300 leading-relaxed">
                VidForge AI turns simple inputs — a photo plus music, or a photo plus a written script — into polished, professional video in seconds. No editing skills needed.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">Built For Growth</h2>
              <p className="text-zinc-300 leading-relaxed">
                A fully built, production-ready platform with user accounts and secure infrastructure. Ready to be taken to the next level under new ownership.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">Market Opportunity</h2>
              <p className="text-zinc-300 leading-relaxed">
                The AI video generation space is expanding fast. With the right leadership and execution, this platform is positioned to capture a meaningful share of a market projected to reach nearly $900 billion by 2033.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* FOOTER — Same Clean Style As Home Page */}
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
                <li><Link href="/team" className="text-zinc-400 hover:text-white">Team</Link></li>
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