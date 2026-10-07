'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { usePathname, useRouter } from 'next/navigation';
import AdminNavbar from '@/components/AdminNavbar';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checking, setChecking] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkAdminAccess = async () => {
      /*
       * Admin login page must remain accessible
       * without an authenticated session.
       */
      if (pathname === '/admin/login') {
        setChecking(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      /*
       * No login
       */
      if (!session) {
        router.replace('/admin/login');
        return;
      }

      /*
       * Wrong account
       */
      if (
        session.user.email?.toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
      ) {
        await supabase.auth.signOut();

        router.replace(
          '/admin/login?error=unauthorized'
        );

        return;
      }

      /*
       * Admin verified.
       */
      setChecking(false);
    };

    checkAdminAccess();
  }, [pathname, router, supabase]);

  /*
   * Don't put the admin navbar on the login page.
   */
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  /*
   * While checking authentication.
   */
  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">

          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />

          <p className="text-zinc-400">
            Checking administrator access...
          </p>

        </div>
      </div>
    );
  }

  /*
   * Authenticated administrator.
   */
  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      <AdminNavbar />

      <div>
        {children}
      </div>

    </div>
  );
}