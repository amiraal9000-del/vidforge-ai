'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import {
  Users,
  Video,
  Wallet,
  CreditCard,
  TrendingUp,
  LogOut,
  RefreshCw,
} from 'lucide-react';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

type DashboardStats = {
  totalUsers: number;
  totalVideos: number;
  totalCredits: number;
  successfulDeposits: number;
  pendingDeposits: number;
  totalRevenue: number;
  totalCreditsSpent: number;
};

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalVideos: 0,
    totalCredits: 0,
    successfulDeposits: 0,
    pendingDeposits: 0,
    totalRevenue: 0,
    totalCreditsSpent: 0,
  });

  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const loadDashboard = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/admin/login');
        return;
      }

      // Only the designated administrator can access this page.
      if (
        session.user.email?.toLowerCase() !==
        ADMIN_EMAIL.toLowerCase()
      ) {
        await supabase.auth.signOut();
        router.replace('/admin/login?error=unauthorized');
        return;
      }

      // -----------------------------
      // TOTAL USERS
      // -----------------------------
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', {
          count: 'exact',
          head: true,
        });

      // -----------------------------
      // TOTAL VIDEOS
      // -----------------------------
      const { count: totalVideos } = await supabase
        .from('user_videos')
        .select('*', {
          count: 'exact',
          head: true,
        });

      // -----------------------------
      // CREDITS CURRENTLY HELD
      // -----------------------------
      const { data: profileCredits } = await supabase
        .from('profiles')
        .select('credits');

      const totalCredits =
        profileCredits?.reduce(
          (sum, profile) => sum + (profile.credits || 0),
          0
        ) || 0;

      // -----------------------------
      // SUCCESSFUL DEPOSITS
      // -----------------------------
      const { data: successfulDeposits } = await supabase
        .from('wallet_deposits')
        .select('amount')
        .eq('status', 'successful');

      const totalRevenue =
        successfulDeposits?.reduce(
          (sum, deposit) =>
            sum + Number(deposit.amount || 0),
          0
        ) || 0;

      // -----------------------------
      // PENDING DEPOSITS
      // -----------------------------
      const { count: pendingDeposits } = await supabase
        .from('wallet_deposits')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('status', 'pending');

      // -----------------------------
      // TOTAL CREDITS SPENT
      // -----------------------------
      const { data: videos } = await supabase
        .from('user_videos')
        .select('cost');

      const totalCreditsSpent =
        videos?.reduce(
          (sum, video) =>
            sum + (video.cost || 0),
          0
        ) || 0;

      setStats({
        totalUsers: totalUsers || 0,
        totalVideos: totalVideos || 0,
        totalCredits,
        successfulDeposits:
          successfulDeposits?.length || 0,
        pendingDeposits: pendingDeposits || 0,
        totalRevenue,
        totalCreditsSpent,
      });
    } catch (error) {
      console.error(
        'Admin dashboard error:',
        error
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">
            Loading admin dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">

      {/* HEADER */}
      <header className="border-b border-zinc-800 bg-zinc-950/95">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">

          <div>
            <h1 className="text-2xl font-bold">
              VidForge{' '}
              <span className="text-purple-400">
                Admin
              </span>
            </h1>

            <p className="text-sm text-zinc-500 mt-1">
              Business command center
            </p>
          </div>

          <div className="flex items-center gap-3">

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />
              Refresh
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-950/40 border border-red-900/50 text-red-400 hover:bg-red-900/40 transition"
            >
              <LogOut size={16} />
              Logout
            </button>

          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h2 className="text-xl font-semibold">
            Overview
          </h2>

          <p className="text-zinc-500 mt-1">
            Monitor VidForge users, deposits and
            video generation.
          </p>
        </div>

        {/* MAIN METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">

          <MetricCard
            title="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={<Users size={22} />}
          />

          <MetricCard
            title="Videos Generated"
            value={stats.totalVideos.toLocaleString()}
            icon={<Video size={22} />}
          />

          <MetricCard
            title="Total Revenue"
            value={`₦${stats.totalRevenue.toLocaleString(
              'en-NG',
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`}
            icon={<Wallet size={22} />}
          />

          <MetricCard
            title="Credits Spent"
            value={stats.totalCreditsSpent.toLocaleString()}
            icon={<CreditCard size={22} />}
          />

        </div>

        {/* SECONDARY METRICS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">

          <MetricCard
            title="Credits Currently Held"
            value={stats.totalCredits.toLocaleString()}
            icon={<TrendingUp size={22} />}
            small
          />

          <MetricCard
            title="Successful Deposits"
            value={stats.successfulDeposits.toLocaleString()}
            icon={<Wallet size={22} />}
            small
          />

          <MetricCard
            title="Pending Deposits"
            value={stats.pendingDeposits.toLocaleString()}
            icon={<CreditCard size={22} />}
            small
          />

        </div>

        {/* QUICK SECTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">

            <h3 className="text-lg font-semibold mb-2">
              Wallet & Revenue
            </h3>

            <p className="text-sm text-zinc-500 mb-5">
              Deposits and payment activity will
              be managed from this area.
            </p>

            <div className="text-3xl font-bold text-emerald-400">
              ₦
              {stats.totalRevenue.toLocaleString(
                'en-NG',
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </div>

            <p className="text-xs text-zinc-600 mt-2">
              Successful wallet deposits
            </p>

          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">

            <h3 className="text-lg font-semibold mb-2">
              Generation Activity
            </h3>

            <p className="text-sm text-zinc-500 mb-5">
              Credits consumed by video generation.
            </p>

            <div className="text-3xl font-bold text-purple-400">
              {stats.totalCreditsSpent.toLocaleString()}
            </div>

            <p className="text-xs text-zinc-600 mt-2">
              Total credits spent on generated videos
            </p>

          </div>

        </div>

      </main>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  small = false,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">

      <div className="flex items-center justify-between mb-4">

        <p className="text-sm text-zinc-500">
          {title}
        </p>

        <div className="text-purple-400">
          {icon}
        </div>

      </div>

      <p
        className={
          small
            ? 'text-2xl font-bold'
            : 'text-3xl font-bold'
        }
      >
        {value}
      </p>

    </div>
  );
}