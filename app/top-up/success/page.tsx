'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

function SuccessContent() {
  const searchParams = useSearchParams();
  const added = searchParams.get('added');
  const [syncing, setSyncing] = useState(true);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    // ✅ Runs ONLY in browser — NEVER during build
    const syncCredits = async () => {
      if (!added) {
        setSyncing(false);
        return;
      }

      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: { session } } = await supabase.auth.getSession();
        
        // ✅ Safe check — no crash if no user
        if (!session || !session.user) {
          toast.info('Please log in to see your updated balance');
          setSyncing(false);
          return;
        }

        const userId = session.user.id;
        const creditsToAdd = parseInt(added);

        const { data: profile } = await supabase
          .from('profiles')
          .select('credits')
          .eq('id', userId)
          .single();

        const currentCredits = profile?.credits ?? 0;
        const newCredits = currentCredits + creditsToAdd;

        await supabase
          .from('profiles')
          .update({ credits: newCredits })
          .eq('id', userId);

        setSynced(true);
        toast.success(`✅ +${creditsToAdd} credits added!`);
      } catch (err) {
        console.error('Sync error:', err);
        toast.success('Payment confirmed! Refresh to see balance');
      } finally {
        setSyncing(false);
      }
    };

    syncCredits();
  }, [added]);

  return (
    <div className="max-w-md w-full text-center">
      {syncing ? (
        <>
          <Loader2 size={64} className="mx-auto text-violet-400 mb-4 animate-spin" />
          <h1 className="text-2xl font-bold mb-2">Confirming Payment...</h1>
          <p className="text-zinc-400">Updating your balance</p>
        </>
      ) : (
        <>
          <CheckCircle size={64} className="mx-auto text-emerald-400 mb-4" />
          <h1 className="text-3xl font-bold mb-2">Payment Successful! 🎉</h1>
          {added && (
            <p className="text-xl text-emerald-400 mb-6">
              +{added} Credits Added
              {synced && <span className="text-sm text-zinc-400 ml-2">✓ Updated</span>}
            </p>
          )}
          
          <div className="bg-zinc-900 rounded-xl border border-emerald-800 p-6 mb-8">
            <p className="text-zinc-300 mb-4">Your credits are ready to use.</p>
            <p className="text-sm text-zinc-500">Create your first video now!</p>
          </div>

          <div className="space-y-3">
            <Link href="/dashboard" className="block w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition">
              Go to Dashboard →
            </Link>
            <Link href="/top-up" className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white">
              <ArrowLeft size={16} /> Top Up More
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={null} />
      
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