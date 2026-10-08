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

    // --------------------------------------------------
    // AUTHENTICATE CURRENT USER
    // --------------------------------------------------

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

    // --------------------------------------------------
    // VERIFY PAYMENT WITH FLUTTERWAVE
    // --------------------------------------------------

    let verifyUrl = '';

    if (transaction_id) {
      verifyUrl =
        `https://api.flutterwave.com/v3/transactions/` +
        `${encodeURIComponent(transaction_id)}/verify`;
    } else {
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

    // --------------------------------------------------
    // PAYMENT MUST ACTUALLY BE SUCCESSFUL
    // --------------------------------------------------

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

    // --------------------------------------------------
    // GET VERIFIED TRANSACTION REFERENCE
    // --------------------------------------------------

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

    // --------------------------------------------------
    // SECURITY:
    // TRANSACTION MUST BELONG TO THIS USER
    // --------------------------------------------------

    const transactionUserId =
      transaction?.meta?.user_id;

    if (
      transactionUserId &&
      transactionUserId !== user.id
    ) {
      return NextResponse.json(
        {
          error:
            'This payment does not belong to the current user.',
        },
        { status: 403 }
      );
    }

    /*
     * Our transaction references are created as:
     *
     * DEP_USER_ID_TIMESTAMP
     *
     * Verify the reference itself belongs to the
     * currently authenticated user.
     */
    const expectedPrefix =
      `DEP_${user.id}_`;

    if (
      !verifiedTxRef.startsWith(expectedPrefix)
    ) {
      return NextResponse.json(
        {
          error:
            'This payment reference does not belong to the current user.',
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // VERIFY CURRENCY
    // --------------------------------------------------

    const verifiedCurrency =
      String(
        transaction.currency || ''
      ).toUpperCase();

    if (verifiedCurrency !== 'NGN') {
      return NextResponse.json(
        {
          error:
            'Payment currency does not match NGN.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // GET VERIFIED AMOUNT
    // --------------------------------------------------

    const verifiedAmount =
      Number(transaction.amount || 0);

    if (
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            'Flutterwave returned an invalid payment amount.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // PREVENT DOUBLE PROCESSING
    // --------------------------------------------------

    const {
      data: existingDeposit,
      error: existingDepositError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('*')
      .eq('tx_ref', verifiedTxRef)
      .maybeSingle();

    if (existingDepositError) {
      console.error(
        'Existing deposit lookup error:',
        existingDepositError
      );

      return NextResponse.json(
        {
          error:
            'Unable to check payment history.',
        },
        { status: 500 }
      );
    }

    /*
     * If the transaction was already recorded,
     * do NOT add credits again.
     */
    if (existingDeposit) {
      if (
        existingDeposit.user_id !== user.id
      ) {
        return NextResponse.json(
          {
            error:
              'This payment does not belong to the current user.',
          },
          { status: 403 }
        );
      }

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
        amount: Number(existingDeposit.amount),
        credits_added: Math.floor(
          Number(existingDeposit.amount) / 10
        ),
        credits:
          Number(
            existingProfile?.credits || 0
          ),
      });
    }

    // --------------------------------------------------
    // CALCULATE CREDITS
    // --------------------------------------------------

    /*
     * Current pricing:
     *
     * ₦10 = 1 credit
     */
    const creditsToAdd = Math.floor(
      verifiedAmount / 10
    );

    if (creditsToAdd <= 0) {
      return NextResponse.json(
        {
          error:
            'This payment does not provide any credits.',
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // MAKE SURE PROFILE EXISTS
    // --------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabaseAdmin
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        'Profile lookup error:',
        profileError
      );

      return NextResponse.json(
        {
          error:
            'Unable to load your credit balance.',
        },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        {
          error:
            'Your VidForge profile could not be found.',
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // CREATE PAID WALLET DEPOSIT
    // --------------------------------------------------

    const {
      data: newDeposit,
      error: depositInsertError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .insert({
        user_id: user.id,
        tx_ref: verifiedTxRef,
        amount: verifiedAmount,
        currency: 'NGN',
        payment_provider: 'flutterwave',
        status: 'paid',
        payment_link: null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (depositInsertError) {
      /*
       * If another request processed the same payment
       * at exactly the same time, the unique tx_ref
       * constraint can protect us from duplication.
       */
      if (
        depositInsertError.code === '23505'
      ) {
        const {
          data: alreadyCreated,
        } = await supabaseAdmin
          .from('wallet_deposits')
          .select('*')
          .eq('tx_ref', verifiedTxRef)
          .maybeSingle();

        const {
          data: latestProfile,
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
          amount:
            Number(
              alreadyCreated?.amount ||
              verifiedAmount
            ),
          credits_added:
            Math.floor(
              Number(
                alreadyCreated?.amount ||
                verifiedAmount
              ) / 10
            ),
          credits:
            Number(
              latestProfile?.credits || 0
            ),
        });
      }

      console.error(
        'Deposit creation error:',
        depositInsertError
      );

      return NextResponse.json(
        {
          error:
            'Payment was verified, but the wallet deposit could not be recorded.',
          payment_verified: true,
          tx_ref: verifiedTxRef,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // ADD CREDITS
    // --------------------------------------------------

    const currentCredits =
      Number(profile.credits || 0);

    const newCredits =
      currentCredits + creditsToAdd;

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
            'Payment was recorded as paid, but credits could not be added automatically.',
          payment_processed: true,
          tx_ref: verifiedTxRef,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    console.log(
      `PAYMENT SUCCESS: ${verifiedTxRef} | User: ${user.id} | Amount: ₦${verifiedAmount} | Credits: +${creditsToAdd}`
    );

    return NextResponse.json({
      success: true,
      already_processed: false,
      status: 'paid',
      tx_ref: verifiedTxRef,
      amount: verifiedAmount,
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