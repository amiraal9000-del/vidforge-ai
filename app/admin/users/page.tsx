'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  RefreshCw,
  Search,
  Video,
  CreditCard,
  Wallet,
} from 'lucide-react';

type AdminUser = {
  id: string;
  email: string | null;
  credits: number;
  created_at: string | null;
  videosGenerated: number;
  creditsSpent: number;
  totalDeposited: number;
};

export default function AdminUsersPage() {
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    try {
      setError('');

      const response = await fetch('/api/admin/users', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await response.json();

      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }

      if (response.status === 403) {
        router.replace('/admin/login?error=unauthorized');
        return;
      }

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to load users.'
        );
      }

      setUsers(data?.users || []);
    } catch (err: any) {
      console.error('Admin users page error:', err);

      setError(
        err?.message || 'Unable to load users.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      setFilteredUsers(users);
      return;
    }

    setFilteredUsers(
      users.filter((user) =>
        (user.email || '')
          .toLowerCase()
          .includes(query)
      )
    );
  }, [search, users]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
  };

  const formatNaira = (amount: number) => {
    return `₦${Number(amount || 0).toLocaleString('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';

    return new Date(date).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">
              Loading users...
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
        <div>
          <p className="text-sm text-purple-400 font-medium mb-2">
            Administration
          </p>

          <div className="flex items-center gap-3">
            <Users
              size={28}
              className="text-purple-400"
            />

            <h1 className="text-3xl font-bold text-white">
              Users
            </h1>
          </div>

          <p className="text-zinc-500 mt-2">
            All registered VidForge users and their
            account activity.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="self-start lg:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={
              refreshing ? 'animate-spin' : ''
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
            Users error
          </p>

          <p className="text-sm text-red-400 mt-1">
            {error}
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <SummaryCard
          label="Total Users"
          value={users.length.toLocaleString()}
          icon={<Users size={20} />}
        />

        <SummaryCard
          label="Total Videos"
          value={users
            .reduce(
              (sum, user) =>
                sum + Number(user.videosGenerated || 0),
              0
            )
            .toLocaleString()}
          icon={<Video size={20} />}
        />

        <SummaryCard
          label="Credits Spent"
          value={users
            .reduce(
              (sum, user) =>
                sum + Number(user.creditsSpent || 0),
              0
            )
            .toLocaleString()}
          icon={<CreditCard size={20} />}
        />
      </div>

      {/* Search */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search users by email..."
            className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950/70 border-b border-zinc-800">
              <tr>
                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  User
                </th>

                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Credits
                </th>

                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Videos
                </th>

                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Credits Spent
                </th>

                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Deposited
                </th>

                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Joined
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-zinc-500"
                  >
                    {search
                      ? 'No users match your search.'
                      : 'No users found.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-zinc-800/70 last:border-b-0 hover:bg-zinc-800/30 transition"
                  >
                    <td className="px-5 py-4">
                      <div className="min-w-[220px]">
                        <p className="text-sm font-medium text-white break-all">
                          {user.email || 'No email'}
                        </p>

                        <p className="text-xs text-zinc-600 mt-1 font-mono">
                          {user.id}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium">
                        {Number(
                          user.credits || 0
                        ).toLocaleString()}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-zinc-300">
                      {Number(
                        user.videosGenerated || 0
                      ).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-zinc-300">
                      {Number(
                        user.creditsSpent || 0
                      ).toLocaleString()}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-emerald-400 font-medium">
                      {formatNaira(
                        user.totalDeposited
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-zinc-500 whitespace-nowrap">
                      {formatDate(
                        user.created_at
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-16 text-center text-zinc-500">
            {search
              ? 'No users match your search.'
              : 'No users found.'}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white break-all">
                    {user.email || 'No email'}
                  </p>

                  <p className="text-[11px] text-zinc-600 mt-1 font-mono break-all">
                    {user.id}
                  </p>
                </div>

                <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-medium">
                  {Number(
                    user.credits || 0
                  ).toLocaleString()}{' '}
                  credits
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <MobileStat
                  icon={<Video size={15} />}
                  label="Videos"
                  value={Number(
                    user.videosGenerated || 0
                  ).toLocaleString()}
                />

                <MobileStat
                  icon={<CreditCard size={15} />}
                  label="Spent"
                  value={Number(
                    user.creditsSpent || 0
                  ).toLocaleString()}
                />

                <MobileStat
                  icon={<Wallet size={15} />}
                  label="Deposited"
                  value={formatNaira(
                    user.totalDeposited
                  )}
                />

                <MobileStat
                  icon={<Users size={15} />}
                  label="Joined"
                  value={formatDate(
                    user.created_at
                  )}
                />
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-zinc-600 mt-5">
        Showing {filteredUsers.length.toLocaleString()} of{' '}
        {users.length.toLocaleString()} users.
      </p>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            {label}
          </p>

          <p className="text-2xl font-bold text-white mt-2">
            {value}
          </p>
        </div>

        <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MobileStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-2 text-zinc-500">
        {icon}
        <span className="text-xs">
          {label}
        </span>
      </div>

      <p className="text-sm font-semibold text-white mt-2 break-words">
        {value}
      </p>
    </div>
  );
}