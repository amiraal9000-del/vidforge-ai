import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const flwSecretKey = process.env.FLUTTERWAVE_SECRET_KEY!;
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// ✅ Fixed: Admin client with proper empty cookies for server
const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
  cookies: {
    getAll: () => [],
    setAll: () => {},
  },
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount } = body;

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // ✅ Fixed: Regular auth client with proper cookie format
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token || '');

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const txRef = `DEP_${user.id}_${Date.now()}`;

    const { data: depositRow, error: depositError } = await supabaseAdmin
      .from('wallet_deposits')
      .insert({
        user_id: user.id,
        tx_ref: txRef,
        amount: Number(amount),
        currency: 'NGN',
        payment_provider: 'flutterwave',
        status: 'pending',
      })
      .select()
      .single();

    if (depositError) {
      console.error('DEPOSIT INSERT ERROR:', depositError);
      return NextResponse.json({ error: 'Unable to create deposit.' }, { status: 500 });
    }

    const creditsToAdd = Math.floor(Number(amount) / 10);

    const flwResponse = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${flwSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: Number(amount),
        currency: 'NGN',
        redirect_url: `${siteUrl}/top-up/success?added=${creditsToAdd}`,
        customer: {
          email: user.email || profile?.email || 'customer@vidforge.ai',
          name: profile?.full_name || profile?.business_name || 'VidForge User',
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
    });

    const flwData = await flwResponse.json();

    if (!flwData?.data?.link) {
      await supabaseAdmin.from('wallet_deposits').delete().eq('tx_ref', txRef);
      return NextResponse.json(
        { error: flwData.message || 'Unable to generate payment link' },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('wallet_deposits')
      .update({ payment_link: flwData.data.link })
      .eq('tx_ref', txRef);

    return NextResponse.json({
      success: true,
      payment_link: flwData.data.link,
      tx_ref: txRef,
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}