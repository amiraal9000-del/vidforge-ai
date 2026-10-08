import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

export async function GET() {
  try {
    /*
     * ---------------------------------------------------------
     * 1. GET CURRENTLY AUTHENTICATED USER
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
     * 2. VERIFY ADMIN
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
     * 3. SERVICE-ROLE ADMIN CLIENT
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
     * 4. TOTAL USERS
     * ---------------------------------------------------------
     */

    const {
      count: totalUsers,
      error: usersError,
    } = await supabaseAdmin
      .from('profiles')
      .select('*', {
        count: 'exact',
        head: true,
      });

    if (usersError) {
      console.error(
        'Admin users query error:',
        usersError
      );

      throw new Error(
        'Unable to read user statistics.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. TOTAL CREDITS CURRENTLY HELD BY USERS
     * ---------------------------------------------------------
     */

    const {
      data: profileCredits,
      error: creditsError,
    } = await supabaseAdmin
      .from('profiles')
      .select('credits');

    if (creditsError) {
      console.error(
        'Admin credits query error:',
        creditsError
      );

      throw new Error(
        'Unable to read credit statistics.'
      );
    }

    const totalCredits =
      profileCredits?.reduce(
        (sum, profile) =>
          sum + Number(profile.credits || 0),
        0
      ) || 0;

    /*
     * ---------------------------------------------------------
     * 6. TOTAL VIDEOS GENERATED
     * ---------------------------------------------------------
     */

    const {
      count: totalVideos,
      error: videosCountError,
    } = await supabaseAdmin
      .from('user_videos')
      .select('*', {
        count: 'exact',
        head: true,
      });

    if (videosCountError) {
      console.error(
        'Admin videos count error:',
        videosCountError
      );

      throw new Error(
        'Unable to read video statistics.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. TOTAL CREDITS SPENT ON GENERATIONS
     * ---------------------------------------------------------
     */

    const {
      data: videos,
      error: videosError,
    } = await supabaseAdmin
      .from('user_videos')
      .select('cost');

    if (videosError) {
      console.error(
        'Admin video cost error:',
        videosError
      );

      throw new Error(
        'Unable to calculate credits spent.'
      );
    }

    const totalCreditsSpent =
      videos?.reduce(
        (sum, video) =>
          sum + Number(video.cost || 0),
        0
      ) || 0;

    /*
     * ---------------------------------------------------------
     * 8. TOTAL WALLET REVENUE
     *
     * IMPORTANT:
     * wallet_deposits now contains ONLY verified/paid deposits.
     *
     * There is no pending or successful filter anymore.
     * Every row represents money received.
     * ---------------------------------------------------------
     */

    const {
      data: deposits,
      error: depositsError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('amount');

    if (depositsError) {
      console.error(
        'Admin deposits query error:',
        depositsError
      );

      throw new Error(
        'Unable to read revenue statistics.'
      );
    }

    const totalRevenue =
      deposits?.reduce(
        (sum, deposit) =>
          sum + Number(deposit.amount || 0),
        0
      ) || 0;

    /*
     * ---------------------------------------------------------
     * 9. TOTAL PAID DEPOSITS
     *
     * Every row in wallet_deposits is now a paid deposit.
     * ---------------------------------------------------------
     */

    const {
      count: totalDeposits,
      error: depositCountError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('*', {
        count: 'exact',
        head: true,
      });

    if (depositCountError) {
      console.error(
        'Deposit count error:',
        depositCountError
      );

      throw new Error(
        'Unable to count wallet deposits.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. RETURN ADMIN STATISTICS
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      stats: {
        totalUsers:
          totalUsers || 0,

        totalVideos:
          totalVideos || 0,

        totalCredits,

        totalCreditsSpent,

        totalRevenue,

        totalDeposits:
          totalDeposits || 0,
      },
    });

  } catch (error: any) {
    console.error(
      'Admin stats API error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unable to load admin statistics.',
      },
      {
        status: 500,
      }
    );
  }
}