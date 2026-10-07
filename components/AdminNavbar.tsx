'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Video,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  {
    label: 'Overview',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    label: 'Deposits & Revenue',
    href: '/admin/deposits',
    icon: Wallet,
  },
  {
    label: 'Generations',
    href: '/admin/generations',
    icon: Video,
  },
];

export default function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    await supabase.auth.signOut();

    router.replace('/admin/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }

    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Desktop / Main bar */}
        <div className="min-h-[72px] flex items-center justify-between gap-4">

          {/* Brand */}
          <Link
            href="/admin"
            className="flex items-center gap-3 shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <span className="text-xl">⚡</span>
            </div>

            <div>
              <div className="font-bold text-white leading-tight">
                VidForge
                <span className="text-purple-400 ml-1">
                  Admin
                </span>
              </div>

              <div className="text-[11px] text-zinc-500">
                Command Center
              </div>
            </div>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2
                    px-4 py-2.5
                    rounded-xl
                    text-sm font-medium
                    transition
                    ${
                      active
                        ? 'bg-purple-600/15 text-purple-300 border border-purple-500/20'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }
                  `}
                >
                  <Icon size={16} />

                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Desktop logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/30 hover:text-red-300 transition disabled:opacity-50"
          >
            <LogOut size={16} />

            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>

          {/* Mobile menu button */}
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            className="lg:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Toggle admin menu"
          >
            {mobileOpen ? (
              <X size={21} />
            ) : (
              <Menu size={21} />
            )}
          </button>
        </div>

        {/* Mobile navigation */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-zinc-800 py-4">

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`
                      flex items-center gap-3
                      px-4 py-3
                      rounded-xl
                      text-sm font-medium
                      transition
                      ${
                        active
                          ? 'bg-purple-600/15 text-purple-300 border border-purple-500/20'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                      }
                    `}
                  >
                    <Icon size={18} />

                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="w-full mt-3 flex items-center gap-3 px-4 py-3 rounded-xl border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-900/30 transition disabled:opacity-50"
            >
              <LogOut size={18} />

              {loggingOut
                ? 'Logging out...'
                : 'Logout'}
            </button>
          </div>
        )}

      </div>
    </header>
  );
}