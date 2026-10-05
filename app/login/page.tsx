'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    window.location.href = redirectTo;
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 py-12">
      <h1 className="text-5xl font-bold text-purple-400 mb-10">Sign In</h1>

      {error && (
        <div className="w-full max-w-md bg-red-900/50 text-red-300 py-3 rounded-lg mb-6 text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="w-full max-w-md space-y-5">
        <div>
          <label className="block text-gray-300 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label className="block text-gray-300 mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-4 bg-slate-900 border border-slate-700 rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-xl text-xl font-semibold bg-purple-600 hover:bg-purple-500 transition-colors mt-4 disabled:opacity-60"
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-8 text-gray-400 text-lg">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-purple-400 hover:text-purple-300">
          Sign Up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-purple-400 text-xl">Loading...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}