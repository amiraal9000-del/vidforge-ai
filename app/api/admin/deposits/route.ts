import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

export async function GET() {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Verify the currently logged-in Supabase user
     * ---------------------------------------------------------
     */

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
        {
          error: 'Unauthorized',
        },
        {
          status: 401,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Verify administrator
     * ---------------------------------------------------------
     */

    if (
      user.email?.toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      return NextResponse.json(
        {
          error: 'Admin access required',
        },
        {
          status: 403,
        }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. Service-role client
     * ---------------------------------------------------------
     */

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
     * ---------------------------------------------------------
     * 4. Read all verified wallet deposits
     *
     * A row in wallet_deposits represents money that has
     * already been verified and paid.
     *
     * We do NOT calculate pending revenue.
     * We do NOT expose pending deposits.
     * ---------------------------------------------------------
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
     * ---------------------------------------------------------
     * 5. Get profile emails
     * ---------------------------------------------------------
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

    /*
     * ---------------------------------------------------------
     * 6. Build profile lookup
     * ---------------------------------------------------------
     */

    const profileMap: Record<
      string,
      string | null
    > = {};

    for (const profile of profiles) {
      profileMap[profile.id] =
        profile.email;
    }

    /*
     * ---------------------------------------------------------
     * 7. Format deposits
     *
     * Every deposit returned here is treated as paid.
     * The API no longer exposes pending/failed/cancelled
     * business states.
     * ---------------------------------------------------------
     */

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

          status: 'paid',

          payment_link:
            deposit.payment_link || null,

          created_at:
            deposit.created_at,

          updated_at:
            deposit.updated_at,
        })
      );

    /*
     * ---------------------------------------------------------
     * 8. Calculate business totals
     * ---------------------------------------------------------
     */

    const totalDeposits =
      formattedDeposits.length;

    const totalRevenue =
      formattedDeposits.reduce(
        (sum, deposit) =>
          sum +
          Number(
            deposit.amount || 0
          ),
        0
      );

    /*
     * ---------------------------------------------------------
     * 9. Return paid-only deposit data
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      deposits:
        formattedDeposits,

      summary: {
        totalDeposits,
        totalRevenue,
      },
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