'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  RefreshCw,
  Search,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

type Deposit = {
  id: number;
  user_id: string;
  email: string | null;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_provider: string;
  status: string;
  payment_link: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DepositSummary = {
  totalDeposits: number;
  totalRevenue: number;
};

export default function AdminDepositsPage() {
  const router = useRouter();

  const [deposits, setDeposits] = useState<Deposit[]>([]);

  const [summary, setSummary] =
    useState<DepositSummary>({
      totalDeposits: 0,
      totalRevenue: 0,
    });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const loadDeposits = async () => {
    try {
      setError('');

      const response = await fetch(
        '/api/admin/deposits',
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
            'Unable to load deposits.'
        );
      }

      setDeposits(data?.deposits || []);

      setSummary(
        data?.summary || {
          totalDeposits: 0,
          totalRevenue: 0,
        }
      );
    } catch (err: any) {
      console.error(
        'Admin deposits page error:',
        err
      );

      setError(
        err?.message ||
          'Unable to load deposits.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeposits();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeposits();
  };

  const filteredDeposits = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) {
      return deposits;
    }

    return deposits.filter((deposit) => {
      return (
        String(
          deposit.email || ''
        )
          .toLowerCase()
          .includes(query) ||
        String(
          deposit.tx_ref || ''
        )
          .toLowerCase()
          .includes(query)
      );
    });
  }, [deposits, search]);

  const formatNaira = (
    amount: number,
    currency = 'NGN'
  ) => {
    if (
      String(currency).toUpperCase() ===
      'NGN'
    ) {
      return `₦${Number(
        amount || 0
      ).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return `${currency} ${Number(
      amount || 0
    ).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDate = (
    date: string | null
  ) => {
    if (!date) return '—';

    return new Date(
      date
    ).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />

            <p className="text-zinc-400">
              Loading deposits...
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
            <Wallet
              size={28}
              className="text-purple-400"
            />

            <h1 className="text-3xl font-bold text-white">
              Deposits & Revenue
            </h1>
          </div>

          <p className="text-zinc-500 mt-2">
            Monitor verified wallet payments and
            business revenue.
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
            Deposits error
          </p>

          <p className="text-sm text-red-400 mt-1">
            {error}
          </p>
        </div>
      )}

      {/* Summary */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <SummaryCard
          title="Total Revenue"
          value={formatNaira(
            summary.totalRevenue
          )}
          description="Total verified wallet deposits"
          icon={
            <TrendingUp size={21} />
          }
        />

        <SummaryCard
          title="Total Deposits"
          value={summary.totalDeposits.toLocaleString()}
          description="Verified wallet payments"
          icon={
            <CheckCircle size={21} />
          }
        />
      </section>

      {/* Search */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          />

          <input
            type="text"
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search by email or transaction reference..."
            className="w-full pl-11 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
        </div>
      </section>

      {/* Desktop table */}
      <div className="hidden md:block bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-950/70 border-b border-zinc-800">
              <tr>
                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  User
                </th>

                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Amount
                </th>

                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Payment
                </th>

                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Transaction
                </th>

                <th className="text-left px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Provider
                </th>

                <th className="text-right px-5 py-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {filteredDeposits.length ===
              0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-16 text-center text-zinc-500"
                  >
                    {search
                      ? 'No deposits match your search.'
                      : 'No deposits found.'}
                  </td>
                </tr>
              ) : (
                filteredDeposits.map(
                  (deposit) => (
                    <tr
                      key={deposit.id}
                      className="border-b border-zinc-800/70 last:border-b-0 hover:bg-zinc-800/30 transition"
                    >
                      <td className="px-5 py-4">
                        <div className="min-w-[190px]">
                          <p className="text-sm font-medium text-white break-all">
                            {deposit.email ||
                              'Unknown user'}
                          </p>

                          <p className="text-xs text-zinc-600 mt-1 font-mono">
                            {deposit.user_id}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-white">
                          {formatNaira(
                            deposit.amount,
                            deposit.currency
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
                          <CheckCircle
                            size={14}
                          />
                          Paid
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="text-xs text-zinc-300 font-mono whitespace-nowrap">
                          {deposit.tx_ref}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="text-sm text-zinc-400 capitalize">
                          {deposit.payment_provider ||
                            '—'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <span className="text-sm text-zinc-500">
                          {formatDate(
                            deposit.created_at
                          )}
                        </span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {filteredDeposits.length ===
        0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-16 text-center text-zinc-500">
            {search
              ? 'No deposits match your search.'
              : 'No deposits found.'}
          </div>
        ) : (
          filteredDeposits.map(
            (deposit) => (
              <div
                key={deposit.id}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white break-all">
                      {deposit.email ||
                        'Unknown user'}
                    </p>

                    <p className="text-xs text-zinc-600 mt-1 font-mono break-all">
                      {deposit.tx_ref}
                    </p>
                  </div>

                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-xs font-medium">
                    <CheckCircle
                      size={14}
                    />
                    Paid
                  </span>
                </div>

                <div className="mt-5">
                  <p className="text-2xl font-bold text-white">
                    {formatNaira(
                      deposit.amount,
                      deposit.currency
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-5">
                  <MobileInfo
                    label="Provider"
                    value={
                      deposit.payment_provider ||
                      '—'
                    }
                  />

                  <MobileInfo
                    label="Date"
                    value={formatDate(
                      deposit.created_at
                    )}
                  />
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-5">
        <p className="text-xs text-zinc-600">
          Showing{' '}
          {filteredDeposits.length.toLocaleString()}{' '}
          of{' '}
          {deposits.length.toLocaleString()}{' '}
          deposits.
        </p>

        <p className="text-xs text-zinc-600">
          All deposits shown here represent
          verified payments.
        </p>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">
            {title}
          </p>

          <p className="text-2xl font-bold text-white mt-2 break-words">
            {value}
          </p>

          <p className="text-xs text-zinc-600 mt-3">
            {description}
          </p>
        </div>

        <div className="shrink-0 w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function MobileInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p className="text-sm text-zinc-300 mt-1 break-words">
        {value}
      </p>
    </div>
  );
}