'use client';

import {
  useEffect,
  useState,
  Suspense,
} from 'react';
import {
  useSearchParams,
} from 'next/navigation';
import {
  CheckCircle,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

type VerificationResult = {
  success?: boolean;
  already_processed?: boolean;
  status?: string;
  tx_ref?: string;
  amount?: number;
  credits_added?: number;
  credits?: number;
  error?: string;
};

function SuccessContent() {
  const searchParams = useSearchParams();

  const transactionId =
    searchParams.get('transaction_id');

  const txRef =
    searchParams.get('tx_ref');

  const status =
    searchParams.get('status');

  const [syncing, setSyncing] =
    useState(true);

  const [verified, setVerified] =
    useState(false);

  const [error, setError] =
    useState('');

  const [result, setResult] =
    useState<VerificationResult | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      /*
       * Flutterwave should return transaction information
       * after payment.
       */
      if (!transactionId && !txRef) {
        setError(
          'No payment transaction information was found.'
        );
        setSyncing(false);
        return;
      }

      /*
       * If Flutterwave explicitly reports a cancelled
       * or failed payment, don't attempt to add credits.
       */
      if (
        status &&
        !['successful', 'completed'].includes(
          status.toLowerCase()
        )
      ) {
        setError(
          'The payment was not completed.'
        );
        setSyncing(false);
        return;
      }

      try {
        const response = await fetch(
          '/api/wallet/verify-payment',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              transaction_id:
                transactionId || undefined,
              tx_ref:
                txRef || undefined,
            }),
          }
        );

        const data: VerificationResult =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error ||
              'Unable to verify payment.'
          );
        }

        if (!data?.success) {
          throw new Error(
            data?.error ||
              'Payment could not be confirmed.'
          );
        }

        setResult(data);
        setVerified(true);

        if (data.already_processed) {
          toast.success(
            'Payment was already processed.'
          );
        } else {
          toast.success(
            `✅ +${data.credits_added || 0} credits added!`
          );
        }
      } catch (err: any) {
        console.error(
          'Payment verification error:',
          err
        );

        setError(
          err?.message ||
            'Unable to verify payment.'
        );

        toast.error(
          err?.message ||
            'Unable to verify payment.'
        );
      } finally {
        setSyncing(false);
      }
    };

    verifyPayment();
  }, [transactionId, txRef, status]);

  return (
    <div className="max-w-md w-full text-center">
      {syncing ? (
        <>
          <Loader2
            size={64}
            className="mx-auto text-violet-400 mb-4 animate-spin"
          />

          <h1 className="text-2xl font-bold mb-2">
            Confirming Payment...
          </h1>

          <p className="text-zinc-400">
            Verifying your payment with
            Flutterwave
          </p>
        </>
      ) : error ? (
        <>
          <AlertCircle
            size={64}
            className="mx-auto text-red-400 mb-4"
          />

          <h1 className="text-3xl font-bold mb-2">
            Payment Not Confirmed
          </h1>

          <p className="text-red-400 mb-6">
            {error}
          </p>

          <div className="bg-zinc-900 rounded-xl border border-red-900/60 p-6 mb-8">
            <p className="text-zinc-300">
              Your account was not credited because
              the payment could not be independently
              verified.
            </p>

            <p className="text-sm text-zinc-500 mt-3">
              If money was deducted from your account,
              please contact support before making
              another payment.
            </p>
          </div>

          <div className="space-y-3">
            <Link
              href="/top-up"
              className="block w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition"
            >
              Back to Top Up
            </Link>

            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={16} />
              Dashboard
            </Link>
          </div>
        </>
      ) : verified ? (
        <>
          <CheckCircle
            size={64}
            className="mx-auto text-emerald-400 mb-4"
          />

          <h1 className="text-3xl font-bold mb-2">
            Payment Successful! 🎉
          </h1>

          {result?.credits_added !==
            undefined && (
            <p className="text-xl text-emerald-400 mb-6">
              +{result.credits_added} Credits Added
            </p>
          )}

          <div className="bg-zinc-900 rounded-xl border border-emerald-800 p-6 mb-8 text-left">
            <div className="space-y-3">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">
                  Payment
                </span>

                <span className="text-emerald-400 font-medium">
                  {result?.status || 'paid'}
                </span>
              </div>

              {result?.amount !==
                undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">
                    Amount
                  </span>

                  <span className="text-white font-medium">
                    ₦
                    {Number(
                      result.amount
                    ).toLocaleString(
                      'en-NG',
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}
                  </span>
                </div>
              )}

              {result?.credits !==
                undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-zinc-500">
                    New Balance
                  </span>

                  <span className="text-purple-400 font-medium">
                    {Number(
                      result.credits
                    ).toLocaleString()}{' '}
                    credits
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="block w-full py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition"
            >
              Go to Dashboard →
            </Link>

            <Link
              href="/top-up"
              className="flex items-center justify-center gap-2 text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={16} />
              Top Up More
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={null} />

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <Suspense
          fallback={
            <div className="max-w-md w-full text-center">
              <Loader2
                size={64}
                className="mx-auto text-violet-400 mb-4 animate-spin"
              />

              <h1 className="text-2xl font-bold mb-2">
                Loading...
              </h1>

              <p className="text-zinc-400">
                Verifying payment
              </p>
            </div>
          }
        >
          <SuccessContent />
        </Suspense>
      </main>
    </div>
  );
}