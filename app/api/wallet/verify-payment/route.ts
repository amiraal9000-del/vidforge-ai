import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY!;

const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      transaction_id,
      tx_ref,
    } = body;

    if (!transaction_id && !tx_ref) {
      return NextResponse.json(
        {
          error:
            'Missing Flutterwave transaction information.',
        },
        { status: 400 }
      );
    }

    /*
     * Authenticate the currently logged-in VidForge user.
     */
    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(
                ({ name, value, options }) => {
                  cookieStore.set(
                    name,
                    value,
                    options
                  );
                }
              );
            } catch {
              // Read-only request.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    /*
     * Verify the transaction directly with Flutterwave.
     */
    let verifyUrl = '';

    if (transaction_id) {
      verifyUrl =
        `https://api.flutterwave.com/v3/transactions/` +
        `${encodeURIComponent(transaction_id)}/verify`;
    } else {
      /*
       * Flutterwave's primary verification endpoint uses
       * transaction_id, so when only tx_ref is available,
       * first locate the transaction.
       */
      verifyUrl =
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=` +
        `${encodeURIComponent(tx_ref)}`;
    }

    const flutterwaveResponse = await fetch(
      verifyUrl,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    const flutterwaveData =
      await flutterwaveResponse.json();

    if (
      !flutterwaveResponse.ok ||
      flutterwaveData?.status !== 'success' ||
      !flutterwaveData?.data
    ) {
      console.error(
        'Flutterwave verification failed:',
        flutterwaveData
      );

      return NextResponse.json(
        {
          error:
            flutterwaveData?.message ||
            'Unable to verify payment with Flutterwave.',
        },
        { status: 400 }
      );
    }

    const transaction =
      flutterwaveData.data;

    /*
     * Flutterwave must report a successful transaction.
     */
    if (
      String(transaction.status || '').toLowerCase() !==
      'successful'
    ) {
      return NextResponse.json(
        {
          error:
            'Payment has not been confirmed as successful.',
          payment_status:
            transaction.status || 'unknown',
        },
        { status: 400 }
      );
    }

    /*
     * The reference returned by Flutterwave.
     */
    const verifiedTxRef =
      transaction.tx_ref || tx_ref;

    if (!verifiedTxRef) {
      return NextResponse.json(
        {
          error:
            'Flutterwave did not return a transaction reference.',
        },
        { status: 400 }
      );
    }

    /*
     * Find the corresponding VidForge deposit.
     */
    const {
      data: deposit,
      error: depositError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('*')
      .eq('tx_ref', verifiedTxRef)
      .maybeSingle();

    if (depositError) {
      console.error(
        'Deposit lookup error:',
        depositError
      );

      return NextResponse.json(
        {
          error:
            'Unable to find the VidForge deposit.',
        },
        { status: 500 }
      );
    }

    if (!deposit) {
      return NextResponse.json(
        {
          error:
            'No matching VidForge deposit was found.',
        },
        { status: 404 }
      );
    }

    /*
     * Security check:
     * The deposit must belong to the logged-in user.
     */
    if (deposit.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'This payment does not belong to the current user.',
        },
        { status: 403 }
      );
    }

    /*
     * Security check:
     * Currency must match what VidForge expects.
     */
    const verifiedCurrency =
      String(
        transaction.currency || ''
      ).toUpperCase();

    const depositCurrency =
      String(
        deposit.currency || 'NGN'
      ).toUpperCase();

    if (
      verifiedCurrency !== depositCurrency
    ) {
      return NextResponse.json(
        {
          error:
            'Payment currency does not match the deposit.',
        },
        { status: 400 }
      );
    }

    /*
     * Security check:
     * The amount paid must match the amount requested.
     */
    const verifiedAmount =
      Number(transaction.amount || 0);

    const depositAmount =
      Number(deposit.amount || 0);

    if (
      !Number.isFinite(verifiedAmount) ||
      !Number.isFinite(depositAmount) ||
      verifiedAmount < depositAmount
    ) {
      return NextResponse.json(
        {
          error:
            'Payment amount does not match the deposit.',
        },
        { status: 400 }
      );
    }

    /*
     * If this deposit was already paid, do NOT add credits again.
     */
    if (
      String(deposit.status || '').toLowerCase() ===
      'paid'
    ) {
      const {
        data: existingProfile,
      } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        already_processed: true,
        status: 'paid',
        tx_ref: verifiedTxRef,
        amount: depositAmount,
        credits_added: Math.floor(
          depositAmount / 10
        ),
        credits:
          Number(
            existingProfile?.credits || 0
          ),
      });
    }

    /*
     * Credits are currently priced at:
     * ₦10 = 1 credit.
     */
    const creditsToAdd = Math.floor(
      depositAmount / 10
    );

    if (creditsToAdd <= 0) {
      return NextResponse.json(
        {
          error:
            'This deposit does not provide any credits.',
        },
        { status: 400 }
      );
    }

    /*
     * Mark the deposit as PAID.
     *
     * The status condition prevents a second request
     * from processing the same pending deposit after
     * another request has already completed it.
     */
    const {
      data: updatedDeposit,
      error: updateDepositError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .update({
        status: 'paid',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deposit.id)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (updateDepositError) {
      console.error(
        'Deposit status update error:',
        updateDepositError
      );

      return NextResponse.json(
        {
          error:
            'Unable to update deposit status.',
        },
        { status: 500 }
      );
    }

    /*
     * If another request already processed it,
     * don't add the credits a second time.
     */
    if (!updatedDeposit) {
      const {
        data: existingProfile,
      } = await supabaseAdmin
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .maybeSingle();

      return NextResponse.json({
        success: true,
        already_processed: true,
        status: 'paid',
        tx_ref: verifiedTxRef,
        amount: depositAmount,
        credits_added: creditsToAdd,
        credits:
          Number(
            existingProfile?.credits || 0
          ),
      });
    }

    /*
     * Read the current credit balance.
     */
    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error(
        'Profile lookup error:',
        profileError
      );

      /*
       * We do NOT silently pretend the payment failed.
       * The deposit is already marked paid, so report the
       * issue clearly for investigation.
       */
      return NextResponse.json(
        {
          error:
            'Payment was marked paid, but the user profile could not be updated.',
          payment_processed: true,
          tx_ref: verifiedTxRef,
        },
        { status: 500 }
      );
    }

    const currentCredits =
      Number(profile.credits || 0);

    const newCredits =
      currentCredits + creditsToAdd;

    /*
     * Add the verified credits.
     */
    const {
      error: creditUpdateError,
    } = await supabaseAdmin
      .from('profiles')
      .update({
        credits: newCredits,
      })
      .eq('id', user.id);

    if (creditUpdateError) {
      console.error(
        'Credit update error:',
        creditUpdateError
      );

      return NextResponse.json(
        {
          error:
            'Payment was confirmed and marked paid, but credits could not be added automatically.',
          payment_processed: true,
          tx_ref: verifiedTxRef,
        },
        { status: 500 }
      );
    }

    console.log(
      `PAYMENT SUCCESS: ${verifiedTxRef} | User: ${user.id} | Amount: ₦${depositAmount} | Credits: +${creditsToAdd}`
    );

    return NextResponse.json({
      success: true,
      already_processed: false,
      status: 'paid',
      tx_ref: verifiedTxRef,
      amount: depositAmount,
      credits_added: creditsToAdd,
      credits: newCredits,
    });
  } catch (error: any) {
    console.error(
      'Verify payment API error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unable to verify payment.',
      },
      { status: 500 }
    );
  }
}