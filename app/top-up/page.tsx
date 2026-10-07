'use client';
import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

const PACKAGES = [
  { id: 'basic', credits: 50, price: 500, label: 'Starter', popular: false },
  { id: 'plus', credits: 200, price: 1500, label: 'Creator', popular: true },
  { id: 'pro', credits: 500, price: 3500, label: 'Pro', popular: false },
  { id: 'max', credits: 1200, price: 7000, label: 'Unlimited', popular: false },
];

export default function TopUpPage() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [credits, setCredits] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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

  const handlePayment = async (pkg: typeof PACKAGES[0]) => {
    setSelectedPackage(pkg.id);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/init-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: pkg.price,
          credits: pkg.credits,
          packageId: pkg.id,
          email: user.email
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start payment');

      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not start payment');
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
            <p className="text-sm text-zinc-500">1 credit = 1 second of video • Pay in Naira</p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {PACKAGES.map(pkg => (
              <div 
                key={pkg.id}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-emerald-500 bg-emerald-950/30 scale-105'
                    : 'border-zinc-800 hover:border-zinc-600'
                } ${pkg.popular ? 'ring-2 ring-violet-500/50' : ''}`}
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
                  onClick={() => handlePayment(pkg)}
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

          <p className="text-center text-xs text-zinc-500 mt-8">
            Secure payment via Flutterwave • Card, Bank Transfer, USSD & Mobile Money accepted
          </p>
        </div>
      </main>
    </div>
  );
}