import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (
      user.email?.toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * Read every deposit.
     *
     * IMPORTANT:
     * We intentionally do NOT filter by status here.
     * This lets the admin see pending, paid, failed,
     * cancelled, or any other status currently stored
     * in the database.
     */
    const {
      data: deposits,
      error: depositsError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select(
        `
        id,
        user_id,
        tx_ref,
        amount,
        currency,
        payment_provider,
        status,
        payment_link,
        created_at,
        updated_at
        `
      )
      .order('created_at', {
        ascending: false,
      });

    if (depositsError) {
      console.error(
        'Admin deposits query error:',
        depositsError
      );

      throw new Error(
        'Unable to load deposits.'
      );
    }

    /*
     * Get the user profiles so the admin page can
     * display email addresses alongside deposits.
     */
    const userIds = Array.from(
      new Set(
        (deposits || []).map(
          (deposit) => deposit.user_id
        )
      )
    );

    let profiles: {
      id: string;
      email: string | null;
    }[] = [];

    if (userIds.length > 0) {
      const {
        data: profileRows,
        error: profilesError,
      } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', userIds);

      if (profilesError) {
        console.error(
          'Admin deposit profiles query error:',
          profilesError
        );

        throw new Error(
          'Unable to load deposit user information.'
        );
      }

      profiles = profileRows || [];
    }

    const profileMap: Record<
      string,
      string | null
    > = {};

    for (const profile of profiles) {
      profileMap[profile.id] =
        profile.email;
    }

    const formattedDeposits =
      (deposits || []).map(
        (deposit) => ({
          id: deposit.id,
          user_id: deposit.user_id,
          email:
            profileMap[deposit.user_id] ||
            null,
          tx_ref: deposit.tx_ref,
          amount: Number(
            deposit.amount || 0
          ),
          currency:
            deposit.currency || 'NGN',
          payment_provider:
            deposit.payment_provider ||
            'flutterwave',
          status:
            deposit.status || 'unknown',
          payment_link:
            deposit.payment_link || null,
          created_at:
            deposit.created_at,
          updated_at:
            deposit.updated_at,
        })
      );

    /*
     * Calculate summary values from the actual
     * statuses stored in the database.
     *
     * "paid" is now the successful status used
     * by our verification flow.
     */
    const totalDeposits =
      formattedDeposits.length;

    const paidDeposits =
      formattedDeposits.filter(
        (deposit) =>
          String(deposit.status)
            .toLowerCase() === 'paid'
      );

    const pendingDeposits =
      formattedDeposits.filter(
        (deposit) =>
          String(deposit.status)
            .toLowerCase() === 'pending'
      );

    const paidRevenue =
      paidDeposits.reduce(
        (sum, deposit) =>
          sum + Number(deposit.amount || 0),
        0
      );

    const pendingRevenue =
      pendingDeposits.reduce(
        (sum, deposit) =>
          sum + Number(deposit.amount || 0),
        0
      );

    /*
     * Keep a breakdown of every status that actually
     * exists in the database.
     */
    const statusBreakdown: Record<
      string,
      number
    > = {};

    for (const deposit of formattedDeposits) {
      const status =
        String(
          deposit.status || 'unknown'
        ).toLowerCase();

      statusBreakdown[status] =
        (statusBreakdown[status] || 0) + 1;
    }

    return NextResponse.json({
      success: true,

      deposits:
        formattedDeposits,

      summary: {
        totalDeposits,
        paidDeposits:
          paidDeposits.length,
        pendingDeposits:
          pendingDeposits.length,
        paidRevenue,
        pendingRevenue,
      },

      statusBreakdown,
    });
  } catch (error: any) {
    console.error(
      'Admin deposits API error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unable to load deposits.',
      },
      {
        status: 500,
      }
    );
  }
}