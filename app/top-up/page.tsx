'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import AppNavbar from '@/components/AppNavbar';
import { CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TopUpPage() {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const quickAmounts = [500, 1000, 5000, 10000];

  const handleDeposit = async () => {
    const numAmount = Number(amount);
    if (!amount || numAmount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.info('Please log in to continue');
        router.push('/login');
        return;
      }

      const res = await fetch('/api/create-wallet-deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ amount: numAmount }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Unable to generate payment link');
      }

      window.open(data.payment_link, '_blank');

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Payment setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={null} />
      
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <CreditCard size={28} className="text-emerald-400" />
            Fund Wallet
          </h1>
          <p className="text-zinc-400 mb-8">Instantly add funds to your VidForge wallet</p>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-emerald-400 mb-4">Select Amount</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {quickAmounts.map((value) => (
                <button
                  key={value}
                  onClick={() => setAmount(String(value))}
                  className={`py-4 rounded-xl border-2 font-bold transition ${
                    Number(amount) === value
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500 text-zinc-200'
                  }`}
                >
                  ₦{value.toLocaleString()}
                </button>
              ))}
            </div>

            <input
              type="number"
              placeholder="Enter custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-4 rounded-xl border border-zinc-700 bg-zinc-950 text-white text-lg mb-6 focus:outline-none focus:border-emerald-500"
              min="100"
            />

            <button
              onClick={handleDeposit}
              disabled={loading}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Generating Payment...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}