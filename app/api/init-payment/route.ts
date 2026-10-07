import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { amount, credits, packageId, email } = await request.json();

    // Validate
    if (!amount || !credits || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    if (!publicKey) {
      return NextResponse.json({ error: 'Flutterwave not configured' }, { status: 500 });
    }

    // Build Flutterwave payment link
    const txRef = `vidforge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const paymentLink = new URL('https://checkout.flutterwave.com/v3/hosted/pay');
    paymentLink.searchParams.set('public_key', publicKey);
    paymentLink.searchParams.set('tx_ref', txRef);
    paymentLink.searchParams.set('amount', String(amount));
    paymentLink.searchParams.set('currency', 'NGN');
    paymentLink.searchParams.set('payment_options', 'card,banktransfer,ussd,mobilemoney');
    paymentLink.searchParams.set('redirect_url', `${baseUrl}/api/payment-success?ref=${txRef}&credits=${credits}`);
    paymentLink.searchParams.set('customer[email]', email);
    paymentLink.searchParams.set('customizations[title]', 'VidForge AI Credits');
    paymentLink.searchParams.set('customizations[description]', `${credits} Credits`);
    paymentLink.searchParams.set('customizations[logo]', 'https://vidforge-ai.vercel.app/logo.png');

    return NextResponse.json({ paymentLink: paymentLink.toString() });
  } catch (err: any) {
    console.error('Payment init error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}