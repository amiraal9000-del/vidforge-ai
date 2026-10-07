'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

function AdminLoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      if (
        session.user.email?.toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
      ) {
        router.replace('/admin');
      } else {
        await supabase.auth.signOut();
      }
    };

    checkSession();

    if (searchParams.get('error') === 'unauthorized') {
      setError('This account does not have administrator access.');
    }
  }, [supabase, router, searchParams]);

  const handleLogin = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError) {
        throw authError;
      }

      if (!data?.session) {
        throw new Error('Login session was not created.');
      }

      const loggedInEmail = data.session.user.email;

      if (
        !loggedInEmail ||
        loggedInEmail.toLowerCase() !==
          ADMIN_EMAIL.toLowerCase()
      ) {
        await supabase.auth.signOut();

        throw new Error(
          'This account does not have administrator access.'
        );
      }

      router.replace('/admin');
      router.refresh();
    } catch (err: any) {
      console.error('Admin login error:', err);

      setError(
        err?.message ||
          'Admin login failed. Please check your details.'
      );

      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 mb-4">
              <span className="text-3xl">⚡</span>
            </div>

            <h1 className="text-3xl font-bold">
              VidForge Admin
            </h1>

            <p className="text-zinc-400 mt-2">
              Administrator access only
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Admin Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Admin email"
                autoComplete="email"
                required
                className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing In...' : 'Sign In to Admin'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-zinc-600">
              VidForge AI • Secure Administrator Access
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
          <p className="text-purple-400">
            Loading...
          </p>
        </div>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}