import Link from 'next/link';

export default function ConfirmedPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
          Email Confirmed!
        </h1>
        <p className="text-zinc-400 mb-8">
          Your account is verified. You can now sign in to VidForge AI.
        </p>
        <Link
          href="/login"
          className="block w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg font-semibold hover:opacity-90"
        >
          Go to Sign In →
        </Link>
      </div>
    </main>
  );
}