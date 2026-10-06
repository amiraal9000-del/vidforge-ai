import Link from 'next/link';
import { Video, Image, FileText, Sparkles, Zap, Shield } from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <PublicNavbar />
      
      {/* HERO SECTION */}
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/10 rounded-full border border-violet-500/20 mb-8">
            <Sparkles size={16} className="text-violet-400" />
            <span className="text-sm text-violet-300">Powered by Zuriedge</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6">
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              VidForge AI
            </span>
            <br />
            Turn Ideas Into Videos Instantly
          </h1>
          
          <p className="text-xl text-zinc-400 max-w-3xl mx-auto mb-10">
            Upload a photo, add music or a script — our AI builds stunning videos in seconds. 
            Professional results, no editing skills needed.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl font-semibold text-lg hover:opacity-90 transition"
            >
              Get Started — It's Free
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 border border-zinc-700 rounded-xl font-semibold text-lg hover:bg-zinc-900 transition"
            >
              Learn More
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-violet-500/50 transition">
              <Image size={32} className="text-violet-400 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Photo + Music → Video</h3>
              <p className="text-zinc-400 text-sm">Upload your image, pick your track — AI creates a full music video</p>
            </div>
            <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-fuchsia-500/50 transition">
              <FileText size={32} className="text-fuchsia-400 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Photo + Script → Video</h3>
              <p className="text-zinc-400 text-sm">Write your story, pair with a visual — generate a short film</p>
            </div>
            <div className="p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 hover:border-pink-500/50 transition">
              <Zap size={32} className="text-pink-400 mb-4 mx-auto" />
              <h3 className="text-lg font-semibold mb-2">Fast & Scalable</h3>
              <p className="text-zinc-400 text-sm">Built for growth — ready to serve millions of creators worldwide</p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <h3 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent mb-3">
                VidForge AI
              </h3>
              <p className="text-zinc-400 text-sm max-w-md">
                Next-generation AI video generation platform. Built by Zuriedge — ready to scale under new ownership.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/" className="text-zinc-400 hover:text-white">Home</Link></li>
                <li><Link href="/about" className="text-zinc-400 hover:text-white">About</Link></li>
                <li><Link href="/team" className="text-zinc-400 hover:text-white">Team</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Account</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="text-zinc-400 hover:text-white">Sign In</Link></li>
                <li><Link href="/signup" className="text-zinc-400 hover:text-white">Get Started</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-zinc-900 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-500 text-sm">
              © 2026 VidForge AI — A Zuriedge Project. All rights reserved.
            </p>
            <p className="text-zinc-500 text-sm">
              This platform is available for acquisition. Serious inquiries welcome.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}