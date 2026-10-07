import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ADMIN_EMAIL = 'Calibossmfr01@gmail.com';

export async function GET() {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Get the currently authenticated Supabase user
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
                  cookieStore.set(name, value, options);
                }
              );
            } catch {
              // Cookie writes are not required for this read-only request.
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
     * 2. Verify this is the designated administrator
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
     * 3. Create a server-side Supabase admin client
     *
     * SERVICE ROLE bypasses RLS.
     *
     * IMPORTANT:
     * This key never goes to the browser.
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
     * 5. ALL PROFILE CREDITS
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
     * 6. TOTAL VIDEOS
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
     * 7. VIDEO COST / CREDITS SPENT
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
     * 8. SUCCESSFUL DEPOSITS
     * ---------------------------------------------------------
     */

    const {
      data: successfulDeposits,
      error: depositsError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('amount')
      .eq('status', 'successful');

    if (depositsError) {
      console.error(
        'Admin deposits query error:',
        depositsError
      );

      throw new Error(
        'Unable to read deposit statistics.'
      );
    }

    const totalRevenue =
      successfulDeposits?.reduce(
        (sum, deposit) =>
          sum + Number(deposit.amount || 0),
        0
      ) || 0;

    /*
     * ---------------------------------------------------------
     * 9. SUCCESSFUL DEPOSIT COUNT
     * ---------------------------------------------------------
     */

    const {
      count: successfulDepositCount,
      error: successfulCountError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'successful');

    if (successfulCountError) {
      console.error(
        'Successful deposit count error:',
        successfulCountError
      );

      throw new Error(
        'Unable to count successful deposits.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. PENDING DEPOSITS
     * ---------------------------------------------------------
     */

    const {
      count: pendingDeposits,
      error: pendingError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select('*', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'pending');

    if (pendingError) {
      console.error(
        'Pending deposit query error:',
        pendingError
      );

      throw new Error(
        'Unable to count pending deposits.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 11. RETURN ADMIN STATISTICS
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      stats: {
        totalUsers: totalUsers || 0,

        totalVideos: totalVideos || 0,

        totalCredits,

        totalCreditsSpent,

        totalRevenue,

        successfulDeposits:
          successfulDepositCount || 0,

        pendingDeposits:
          pendingDeposits || 0,
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