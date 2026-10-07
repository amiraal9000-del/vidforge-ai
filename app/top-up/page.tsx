'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Loader2, Plus, Info } from 'lucide-react';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

const PACKAGES = [
  { id: 'basic', credits: 50, price: 500, label: 'Starter', popular: false },
  { id: 'plus', credits: 200, price: 1500, label: 'Creator', popular: true },
  { id: 'pro', credits: 500, price: 3500, label: 'Pro', popular: false },
  { id: 'max', credits: 1200, price: 7000, label: 'Unlimited', popular: false },
];

// Rate: 1 credit = ₦10 (keeps package pricing consistent)
const RATE_PER_CREDIT = 10;
const MIN_CUSTOM_CREDITS = 50;

export default function TopUpPage() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [credits, setCredits] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customCredits, setCustomCredits] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);
      const { data } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();
      setCredits(data?.credits ?? 0);
      setLoadingUser(false);
    };
    init();
  }, [supabase, router]);

  // Calculate custom pricing
  const customNum = parseInt(customCredits) || 0;
  const customIsValid = customNum >= MIN_CUSTOM_CREDITS;
  const customPrice = customIsValid ? customNum * RATE_PER_CREDIT : 0;

  const handlePayment = async (pkgCredits: number, pkgPrice: number, pkgId?: string) => {
    setSelectedPackage(pkgId || 'custom');
    setIsProcessing(true);

    try {
      const res = await fetch('/api/init-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pkgPrice,
          credits: pkgCredits,
          packageId: pkgId || 'custom',
          email: user.email
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');

      // ✅ WHAT HAPPENS WHEN CLICKED:
      // Opens Flutterwave checkout page in SAME tab — user pays → auto-redirects back
      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      } else {
        throw new Error('No payment link received');
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not start payment');
    } finally {
      setIsProcessing(false);
      setSelectedPackage(null);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={user} />
      
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
            <ArrowLeft size={16} /> Back
          </button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Top Up Credits</h1>
            <p className="text-zinc-400 mb-4">Your current balance: <span className="text-emerald-400 font-bold text-xl">{credits}</span> credits</p>
            <p className="text-sm text-zinc-500">1 credit = ₦{RATE_PER_CREDIT} • Minimum: {MIN_CUSTOM_CREDITS} credits</p>
          </div>

          {/* Quick Packages */}
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            {PACKAGES.map(pkg => (
              <div 
                key={pkg.id}
                className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer ${
                  selectedPackage === pkg.id
                    ? 'border-emerald-500 bg-emerald-950/30 scale-105'
                    : 'border-zinc-800 hover:border-zinc-600'
                } ${pkg.popular ? 'ring-2 ring-violet-500/50' : ''}`}
                onClick={() => { setUseCustom(false); setSelectedPackage(null); }}
              >
                {pkg.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-full">
                    MOST POPULAR
                  </span>
                )}
                <h3 className="font-bold text-lg mb-1">{pkg.label}</h3>
                <p className="text-3xl font-bold text-emerald-400 mb-3">{pkg.credits}</p>
                <p className="text-zinc-400 text-sm mb-5">credits</p>
                <p className="text-2xl font-bold mb-5">₦{pkg.price.toLocaleString()}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); handlePayment(pkg.credits, pkg.price, pkg.id); }}
                  disabled={isProcessing && selectedPackage === pkg.id}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                >
                  {isProcessing && selectedPackage === pkg.id ? (
                    <><Loader2 size={18} className="animate-spin" /> Starting...</>
                  ) : (
                    <><CreditCard size={18} /> Buy Now</>
                  )}
                </button>
              </div>
            ))}
          </div>

          {/* Custom Amount Section */}
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            <button 
              onClick={() => setUseCustom(!useCustom)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="font-bold text-lg flex items-center gap-2">
                <Plus size={20} className="text-violet-400" />
                Custom Amount
              </span>
              <span className="text-zinc-400 text-sm">
                {useCustom ? '▲ Collapse' : '▼ Enter your own'}
              </span>
            </button>

            {useCustom && (
              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 rounded-lg text-sm">
                  <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-zinc-300">
                    Enter <strong>{MIN_CUSTOM_CREDITS}</strong> credits or more. Rate: <strong>₦{RATE_PER_CREDIT}</strong> per credit.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Number of Credits</label>
                  <input
                    type="number"
                    min={MIN_CUSTOM_CREDITS}
                    value={customCredits}
                    onChange={(e) => setCustomCredits(e.target.value)}
                    placeholder={`e.g. ${MIN_CUSTOM_CREDITS}, 100, 300...`}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 text-lg"
                  />
                </div>

                {customNum > 0 && (
                  <div className={`p-4 rounded-lg border ${customIsValid ? 'border-emerald-700 bg-emerald-950/30' : 'border-red-800 bg-red-950/30'}`}>
                    {customIsValid ? (
                      <>
                        <p className="text-lg">
                          <span className="text-zinc-400">Total to Pay:</span>{' '}
                          <strong className="text-2xl text-emerald-400">₦{customPrice.toLocaleString()}</strong>
                        </p>
                        <p className="text-sm text-zinc-400 mt-1">
                          You'll receive <strong>{customNum}</strong> credits
                        </p>
                      </>
                    ) : (
                      <p className="text-red-400">
                        Minimum {MIN_CUSTOM_CREDITS} credits — please enter a higher amount
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => handlePayment(customNum, customPrice)}
                  disabled={!customIsValid || (isProcessing && selectedPackage === 'custom')}
                  className="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                >
                  {isProcessing && selectedPackage === 'custom' ? (
                    <><Loader2 size={18} className="animate-spin" /> Starting Payment...</>
                  ) : (
                    <><CreditCard size={18} /> Pay ₦{customPrice.toLocaleString() || '0'}</>
                  )}
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-xs text-zinc-500 mt-8">
            Secure payment via Flutterwave • Card, Bank Transfer, USSD & Mobile Money accepted
          </p>
        </div>
      </main>
    </div>
  );
}