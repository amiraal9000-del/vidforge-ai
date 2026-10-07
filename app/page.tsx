import Link from 'next/link';
import {
  Video,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  Play,
  CheckCircle2,
  Wand2,
  Mic,
  Clapperboard,
} from 'lucide-react';
import PublicNavbar from '@/components/PublicNavbar';

/*
|--------------------------------------------------------------------------
| VIDFORGE DEMO VIDEOS
|--------------------------------------------------------------------------
| Put your real public Supabase video URLs here.
|
| Example:
| const demoVideos = [
|   {
|     title: 'First Lady AI Video',
|     description: 'One photo transformed into a cinematic speaking video.',
|     src: 'https://YOUR-SUPABASE-URL/storage/v1/object/public/input-images/generated-videos/....mp4',
|   },
| ];
|
| If src is empty, the page shows a beautiful demo placeholder instead.
|--------------------------------------------------------------------------
*/

const demoVideos = [
  {
    title: 'AI Speaking Video',
    description: 'Turn a single photo into a realistic speaking video.',
    src: '',
  },
  {
    title: 'Zuriedge AI Bot',
    description: 'Create engaging AI characters and promotional videos.',
    src: '',
  },
  {
    title: 'Cinematic AI Scene',
    description: 'Bring your ideas, characters and stories to life.',
    src: '',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white overflow-hidden">
      <PublicNavbar />

      {/* ================================================================
          HERO
      ================================================================= */}

      <main>
        <section className="relative">
          {/* Background glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-violet-600/15 blur-[140px] rounded-full" />
            <div className="absolute top-[500px] left-0 w-[350px] h-[350px] bg-fuchsia-600/10 blur-[120px] rounded-full" />
            <div className="absolute top-[600px] right-0 w-[350px] h-[350px] bg-pink-600/10 blur-[120px] rounded-full" />
          </div>

          <div className="relative max-w-7xl mx-auto px-5 sm:px-6 pt-16 md:pt-24 pb-20">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              
              {/* LEFT */}
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 mb-7">
                  <Sparkles size={15} className="text-violet-400" />
                  <span className="text-sm text-violet-300">
                    AI Video Creation by Zuriedge
                  </span>
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] mb-7">
                  Turn One Photo
                  <br />
                  Into a{' '}
                  <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                    Real Video.
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-zinc-400 max-w-xl leading-relaxed mb-9">
                  Give VidForge AI a photo and your idea. Create cinematic,
                  talking and promotional videos in minutes — without
                  complicated video editing.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/signup"
                    className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 font-bold text-lg shadow-xl shadow-violet-900/20 hover:scale-[1.02] transition"
                  >
                    Create Your First Video
                    <ArrowRight
                      size={19}
                      className="group-hover:translate-x-1 transition"
                    />
                  </Link>

                  <a
                    href="#demo"
                    className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 transition font-semibold text-lg"
                  >
                    <Play size={17} />
                    See It In Action
                  </a>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-8 text-sm text-zinc-500">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    No editing skills
                  </span>

                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    AI-powered
                  </span>

                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    Ready in minutes
                  </span>
                </div>
              </div>

              {/* RIGHT — HERO DEMO */}
              <div className="relative">
                <div className="absolute -inset-5 bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-pink-600/20 blur-3xl rounded-[40px]" />

                <div className="relative rounded-[28px] border border-zinc-800 bg-zinc-900/80 p-3 shadow-2xl">
                  <div className="rounded-[20px] overflow-hidden bg-black aspect-[9/12] sm:aspect-video relative">
                    {demoVideos[0].src ? (
                      <video
                        src={demoVideos[0].src}
                        autoPlay
                        muted
                        loop
                        playsInline
                        controls
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-zinc-950 to-pink-950">
                        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl shadow-violet-500/30 mb-6">
                          <Video size={38} />
                        </div>

                        <p className="text-xl font-bold mb-2">
                          Your AI Video Appears Here
                        </p>

                        <p className="text-sm text-zinc-400 text-center max-w-xs px-5">
                          Upload a photo, add your script and let VidForge
                          bring it to life.
                        </p>

                        <Link
                          href="/signup"
                          className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 transition"
                        >
                          Try VidForge
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    )}

                    <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-medium">
                      ✨ Powered by AI
                    </div>
                  </div>
                </div>

                {/* Floating card */}
                <div className="absolute -bottom-5 -left-4 sm:-left-8 bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                    <Sparkles size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">VidForge AI</p>
                    <p className="text-sm font-semibold">
                      Video generated ✨
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            DEMO SECTION
        ================================================================= */}

        <section
          id="demo"
          className="relative max-w-7xl mx-auto px-5 sm:px-6 py-24"
        >
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-violet-400 text-sm font-semibold mb-4">
              <Play size={15} />
              SEE VIDFORGE IN ACTION
            </div>

            <h2 className="text-4xl md:text-5xl font-bold mb-5">
              Your ideas can look like this.
            </h2>

            <p className="text-zinc-400 text-lg">
              From talking characters to cinematic scenes, VidForge turns
              simple ideas into videos people actually want to watch.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {demoVideos.map((video, index) => (
              <div
                key={video.title}
                className="group rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 hover:border-violet-500/40 transition"
              >
                <div className="aspect-[9/12] bg-gradient-to-br from-violet-950/60 via-zinc-950 to-fuchsia-950 relative overflow-hidden">
                  {video.src ? (
                    <video
                      src={video.src}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mb-5">
                        {index === 0 ? (
                          <Mic className="text-violet-400" />
                        ) : index === 1 ? (
                          <Sparkles className="text-fuchsia-400" />
                        ) : (
                          <Clapperboard className="text-pink-400" />
                        )}
                      </div>

                      <p className="text-sm text-zinc-500 mb-2">
                        SAMPLE VIDEO
                      </p>

                      <p className="font-semibold text-lg">
                        Coming from your VidForge library
                      </p>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-xs">
                    AI Generated
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-lg mb-2">
                    {video.title}
                  </h3>

                  <p className="text-sm text-zinc-400">
                    {video.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 font-semibold"
            >
              Make your own video
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>

        {/* ================================================================
            HOW IT WORKS
        ================================================================= */}

        <section className="border-y border-zinc-900 bg-zinc-950/80">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-24">
            <div className="text-center mb-14">
              <p className="text-violet-400 text-sm font-bold mb-3">
                SIMPLE BY DESIGN
              </p>

              <h2 className="text-4xl md:text-5xl font-bold">
                From idea to video in 3 steps.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  number: '01',
                  icon: ImageIcon,
                  title: 'Upload a photo',
                  text: 'Choose the image you want to bring to life.',
                },
                {
                  number: '02',
                  icon: FileText,
                  title: 'Add your idea',
                  text: 'Write your script or describe the video you want.',
                },
                {
                  number: '03',
                  icon: Wand2,
                  title: 'Generate',
                  text: 'VidForge AI transforms your idea into a video.',
                },
              ].map((step) => {
                const Icon = step.icon;

                return (
                  <div
                    key={step.number}
                    className="relative p-7 rounded-2xl bg-zinc-900/60 border border-zinc-800"
                  >
                    <span className="absolute top-5 right-6 text-5xl font-black text-zinc-800">
                      {step.number}
                    </span>

                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
                      <Icon className="text-violet-400" size={23} />
                    </div>

                    <h3 className="text-xl font-bold mb-3">
                      {step.title}
                    </h3>

                    <p className="text-zinc-400 leading-relaxed">
                      {step.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================================================================
            FEATURES
        ================================================================= */}

        <section className="max-w-7xl mx-auto px-5 sm:px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-violet-400 text-sm font-bold mb-4">
                BUILT FOR CREATORS
              </p>

              <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
                You bring the idea.
                <br />
                <span className="text-zinc-500">
                  VidForge brings it to life.
                </span>
              </h2>

              <p className="text-zinc-400 text-lg leading-relaxed mb-8">
                Stop spending hours learning complicated editing software.
                VidForge gives you the tools to turn simple concepts into
                engaging AI-powered videos.
              </p>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-black font-bold hover:bg-zinc-200 transition"
              >
                Start Creating
                <ArrowRight size={17} />
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  icon: Video,
                  title: 'AI Video Generation',
                  text: 'Transform images and ideas into engaging videos.',
                },
                {
                  icon: Mic,
                  title: 'AI Voice & Audio',
                  text: 'Create videos that can speak and tell your story.',
                },
                {
                  icon: Sparkles,
                  title: 'Creative Freedom',
                  text: 'Characters, promotions, stories and more.',
                },
                {
                  icon: Zap,
                  title: 'Fast Creation',
                  text: 'Go from concept to generated video without editing.',
                },
                {
                  icon: Shield,
                  title: 'Your Content',
                  text: 'Your generated videos stay available in your account.',
                },
                {
                  icon: Clapperboard,
                  title: 'Creator Ready',
                  text: 'Make content for social media, marketing and business.',
                },
              ].map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900 hover:border-violet-500/30 transition"
                  >
                    <Icon
                      size={22}
                      className="text-violet-400 mb-4"
                    />

                    <h3 className="font-semibold mb-2">
                      {feature.title}
                    </h3>

                    <p className="text-sm text-zinc-500 leading-relaxed">
                      {feature.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ================================================================
            ZURIEDGE SECTION
        ================================================================= */}

        <section className="relative overflow-hidden border-y border-zinc-900">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-950/30 via-zinc-950 to-fuchsia-950/20" />

          <div className="relative max-w-7xl mx-auto px-5 sm:px-6 py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm mb-5">
                  <Sparkles size={14} />
                  A Zuriedge Project
                </div>

                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Built for the next generation of creators.
                </h2>

                <p className="text-zinc-400 text-lg leading-relaxed mb-8">
                  VidForge AI is part of the Zuriedge ecosystem — building
                  practical AI tools that help people create, sell and grow
                  online.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/signup"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 font-bold hover:opacity-90 transition"
                  >
                    Join VidForge
                    <ArrowRight size={17} />
                  </Link>

                  <Link
                    href="/about"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-700 hover:bg-zinc-900 transition font-semibold"
                  >
                    Learn About Us
                  </Link>
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <div className="relative mx-auto max-w-md">
                  <div className="absolute -inset-8 bg-violet-600/20 blur-3xl rounded-full" />

                  <div className="relative aspect-square rounded-[32px] border border-zinc-800 bg-zinc-900 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.2),transparent_60%)]" />

                    <div className="relative text-center p-8">
                      <div className="w-28 h-28 mx-auto rounded-[30px] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-violet-900/40 mb-7">
                        <Sparkles size={52} />
                      </div>

                      <h3 className="text-3xl font-black mb-2">
                        Zuriedge
                      </h3>

                      <p className="text-zinc-400">
                        Smarter tools.
                        <br />
                        Bigger possibilities.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================
            FINAL CTA
        ================================================================= */}

        <section className="max-w-5xl mx-auto px-5 sm:px-6 py-28 text-center">
          <div className="relative rounded-[32px] overflow-hidden border border-violet-500/20 bg-gradient-to-br from-violet-950/60 via-zinc-900 to-fuchsia-950/50 p-10 sm:p-16">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 bg-violet-500/20 blur-[100px] rounded-full" />

            <div className="relative">
              <Sparkles
                size={28}
                className="mx-auto text-violet-400 mb-6"
              />

              <h2 className="text-4xl md:text-6xl font-black mb-6">
                Your next video
                <br />
                starts with one idea.
              </h2>

              <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-9">
                Upload your photo. Tell VidForge what you want.
                Let AI do the rest.
              </p>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-white text-black font-bold text-lg hover:bg-zinc-200 hover:scale-[1.02] transition"
              >
                Create My First Video
                <ArrowRight size={19} />
              </Link>

              <p className="text-xs text-zinc-500 mt-5">
                Start creating with VidForge AI today.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ================================================================
          FOOTER
      ================================================================= */}

      <footer className="border-t border-zinc-900 py-12 px-5 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent mb-4">
                VidForge AI
              </h3>

              <p className="text-zinc-400 text-sm max-w-md leading-relaxed">
                Turn ideas into videos with AI. Create speaking characters,
                promotional videos, cinematic scenes and more — without
                complicated editing.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">
                Platform
              </h4>

              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    href="/"
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Home
                  </Link>
                </li>

                <li>
                  <Link
                    href="/about"
                    className="text-zinc-500 hover:text-white transition"
                  >
                    About
                  </Link>
                </li>

                <li>
                  <Link
                    href="/team"
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Team
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">
                Account
              </h4>

              <ul className="space-y-3 text-sm">
                <li>
                  <Link
                    href="/login"
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Sign In
                  </Link>
                </li>

                <li>
                  <Link
                    href="/signup"
                    className="text-zinc-500 hover:text-white transition"
                  >
                    Create Account
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-7 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-zinc-600 text-sm text-center md:text-left">
              © 2026 VidForge AI — A Zuriedge Project. All rights reserved.
            </p>

            <p className="text-zinc-600 text-sm text-center md:text-right">
              Built for creators. Powered by AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}