'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` }
    });

    if (err) return setError(err.message);
    
    if (data.user?.identities?.length === 0) {
      setMessage('✅ Account already exists! Please check your email or sign in below.');
    } else {
      setMessage(
        '✅ Account created! Please check your email inbox. ' +
        'You will receive a message from Supabase — click the link inside, ' +
        'it will open in your browser and confirm your account. ' +
        'Once confirmed, simply go to Sign In to get started.'
      );
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-8 border border-zinc-800">
        <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
          VidForge AI
        </h1>
        <p className="text-center text-zinc-400 mb-8">Create your account</p>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-700 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Password (min 6 characters)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full p-3 rounded-lg bg-zinc-950 border border-zinc-700 focus:outline-none focus:border-violet-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-green-400 text-sm leading-relaxed">{message}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg font-semibold hover:opacity-90"
          >
            Create Account
          </button>
        </form>

        <p className="mt-6 text-center text-zinc-400 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-violet-400 hover:underline">
            Sign In →
          </Link>
        </p>
      </div>
    </main>
  );
}