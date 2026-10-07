'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import AppNavbar from '@/components/AppNavbar';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const added = searchParams.get('added');
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (added) setShowConfetti(true);
  }, [added]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={null} />
      
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="max-w-md w-full text-center">
          <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4" />
          <h1 className="text-3xl font-bold mb-2">Payment Successful! 🎉</h1>
          <p className="text-xl text-emerald-400 mb-6">+{added} Credits Added</p>
          
          <div className="bg-zinc-900 rounded-xl border border-emerald-800 p-6 mb-8">
            <p className="text-zinc-300 mb-4">Your credits have been added to your account.</p>
            <p className="text-sm text-zinc-500">Ready to create your video?</p>
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
      </main>
    </div>
  );
}