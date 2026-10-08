import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY!;

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'http://localhost:3000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount } = body;

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // AUTHENTICATE USER
    // --------------------------------------------------

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // --------------------------------------------------
    // GET USER PROFILE
    // --------------------------------------------------

    const supabaseAdmin = createServerClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => {},
        },
      }
    );

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // --------------------------------------------------
    // CREATE UNIQUE FLUTTERWAVE REFERENCE
    // --------------------------------------------------

    const txRef = `DEP_${user.id}_${Date.now()}`;

    const creditsToAdd = Math.floor(numericAmount / 10);

    // --------------------------------------------------
    // CREATE FLUTTERWAVE PAYMENT
    // --------------------------------------------------

    const flwResponse = await fetch(
      'https://api.flutterwave.com/v3/payments',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${flwSecretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: txRef,
          amount: numericAmount,
          currency: 'NGN',

          redirect_url:
            `${siteUrl}/top-up/success?tx_ref=${encodeURIComponent(txRef)}`,

          customer: {
            email:
              user.email ||
              profile?.email ||
              'customer@vidforge.ai',

            name:
              profile?.full_name ||
              profile?.business_name ||
              'VidForge User',
          },

          customizations: {
            title: 'VidForge Credits Top Up',
            description: 'Credit Purchase',
          },

          meta: {
            type: 'wallet_deposit',
            user_id: user.id,
          },
        }),
      }
    );

    const flwData = await flwResponse.json();

    // --------------------------------------------------
    // HANDLE FLUTTERWAVE FAILURE
    // --------------------------------------------------

    if (!flwResponse.ok || !flwData?.data?.link) {
      console.error(
        'FLUTTERWAVE PAYMENT ERROR:',
        flwData
      );

      return NextResponse.json(
        {
          error:
            flwData?.message ||
            'Unable to generate payment link',
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // RETURN PAYMENT LINK
    // --------------------------------------------------

    return NextResponse.json({
      success: true,
      payment_link: flwData.data.link,
      tx_ref: txRef,
      amount: numericAmount,
      credits_to_add: creditsToAdd,
    });

  } catch (err: any) {
    console.error(
      'CREATE WALLET DEPOSIT ERROR:',
      err
    );

    return NextResponse.json(
      {
        error:
          err?.message ||
          'Unable to create payment.',
      },
      { status: 500 }
    );
  }
}