'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

function SuccessContent() {
  const searchParams = useSearchParams();
  const added = searchParams.get('added');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (added) {
      toast.success(`✅ +${added} Credits Added!`);
    }
    setReady(true);
  }, [added]);

  if (!ready) {
    return (
      <div className="max-w-md w-full text-center">
        <Loader2 size={64} className="mx-auto text-violet-400 mb-4 animate-spin" />
        <h1 className="text-2xl font-bold mb-2">Confirming Payment...</h1>
        <p className="text-zinc-400">Completing your purchase</p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full text-center">
      <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4" />
      <h1 className="text-3xl font-bold mb-2">Payment Successful! 🎉</h1>
      {added && (
        <p className="text-xl text-emerald-400 mb-6">+{added} Credits Added</p>
      )}
      
      <div className="bg-zinc-900 rounded-xl border border-emerald-800 p-6 mb-8">
        <p className="text-zinc-300 mb-4">Your credits are ready to use.</p>
        <p className="text-sm text-zinc-500">Go to Dashboard to see your updated balance.</p>
      </div>

      <div className="space-y-3">
        <Link href="/dashboard" className="block w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition">
          Go to Dashboard →
        </Link>
        <Link href="/top-up" className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white">
          <ArrowLeft size={16} /> Top Up More
        </Link>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar />
      
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Suspense fallback={
          <div className="max-w-md w-full text-center">
            <Loader2 size={64} className="mx-auto text-violet-400 mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Loading...</h1>
            <p className="text-zinc-400">Verifying payment</p>
          </div>
        }>
          <SuccessContent />
        </Suspense>
      </main>
    </div>
  );
}