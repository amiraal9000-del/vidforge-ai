'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Video,
  Wallet,
  CreditCard,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

type DashboardStats = {
  totalUsers: number;
  totalVideos: number;
  totalCredits: number;
  totalDeposits: number;
  totalRevenue: number;
  totalCreditsSpent: number;
};

export default function AdminOverviewPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalVideos: 0,
    totalCredits: 0,
    totalDeposits: 0,
    totalRevenue: 0,
    totalCreditsSpent: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadStats = async () => {
    try {
      setError('');

      const response = await fetch(
        '/api/admin/stats',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (response.status === 403) {
        router.replace(
          '/admin/login?error=unauthorized'
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Unable to load dashboard statistics.'
        );
      }

      if (!data?.stats) {
        throw new Error(
          'No dashboard statistics were returned.'
        );
      }

      setStats(data.stats);
    } catch (err: any) {
      console.error(
        'Admin overview error:',
        err
      );

      setError(
        err?.message ||
          'Unable to load dashboard statistics.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadStats();
  };

  const formatNaira = (amount: number) => {
    return `₦${Number(amount || 0).toLocaleString(
      'en-NG',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />

            <p className="text-zinc-400">
              Loading overview...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* Page heading */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">

        <div>
          <p className="text-sm text-purple-400 font-medium mb-2">
            Dashboard
          </p>

          <h1 className="text-3xl font-bold text-white">
            Overview
          </h1>

          <p className="text-zinc-500 mt-2">
            A quick view of your VidForge business.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              refreshing
                ? 'animate-spin'
                : ''
            }
          />

          {refreshing
            ? 'Refreshing...'
            : 'Refresh'}
        </button>

      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 px-5 py-4">
          <p className="font-medium text-red-300">
            Dashboard error
          </p>

          <p className="text-sm text-red-400 mt-1">
            {error}
          </p>
        </div>
      )}

      {/* Main statistics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        <StatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          description="Registered VidForge users"
          icon={<Users size={22} />}
        />

        <StatCard
          title="Videos Generated"
          value={stats.totalVideos.toLocaleString()}
          description="All generated videos"
          icon={<Video size={22} />}
        />

        <StatCard
          title="Revenue"
          value={formatNaira(stats.totalRevenue)}
          description="Total verified wallet revenue"
          icon={<Wallet size={22} />}
        />

        <StatCard
          title="Credits Spent"
          value={stats.totalCreditsSpent.toLocaleString()}
          description="Credits consumed by generation"
          icon={<CreditCard size={22} />}
        />

      </section>

      {/* Secondary statistics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">

        <StatCard
          title="Credits Held"
          value={stats.totalCredits.toLocaleString()}
          description="Credits currently held by users"
          icon={<TrendingUp size={22} />}
          compact
        />

        <StatCard
          title="Wallet Deposits"
          value={stats.totalDeposits.toLocaleString()}
          description="Verified wallet deposits"
          icon={<Wallet size={22} />}
          compact
        />

      </section>

      {/* Admin sections */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">

        <AdminSectionCard
          title="Users"
          description="View users, balances and account activity."
          href="/admin/users"
          icon={<Users size={22} />}
        />

        <AdminSectionCard
          title="Deposits & Revenue"
          description="Inspect wallet deposits, payments and revenue."
          href="/admin/deposits"
          icon={<Wallet size={22} />}
        />

        <AdminSectionCard
          title="Generations"
          description="Inspect generated videos and credit spending."
          href="/admin/generations"
          icon={<Video size={22} />}
        />

      </section>

    </main>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  compact = false,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

      <div className="flex items-start justify-between gap-4">

        <div className="min-w-0">
          <p className="text-sm text-zinc-500">
            {title}
          </p>

          <p
            className={
              compact
                ? 'text-2xl font-bold text-white mt-3 break-words'
                : 'text-3xl font-bold text-white mt-3 break-words'
            }
          >
            {value}
          </p>
        </div>

        <div className="shrink-0 w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
          {icon}
        </div>

      </div>

      <p className="text-xs text-zinc-600 mt-4">
        {description}
      </p>

    </div>
  );
}

function AdminSectionCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={() => {
        window.location.href = href;
      }}
      className="text-left bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-purple-500/40 hover:bg-zinc-900/80 transition group"
    >

      <div className="w-11 h-11 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-5 group-hover:bg-purple-600/20 transition">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-white">
        {title}
      </h3>

      <p className="text-sm text-zinc-500 mt-2 leading-6">
        {description}
      </p>

      <p className="text-sm text-purple-400 mt-5">
        Open section →
      </p>

    </button>
  );
}