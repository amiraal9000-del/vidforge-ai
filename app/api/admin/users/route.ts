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
     *
     * This runs ONLY on the server.
     * It bypasses RLS so the admin can see all users.
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
     * 4. Get all profiles
     * ---------------------------------------------------------
     */

    const {
      data: profiles,
      error: profilesError,
    } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, email, credits, created_at'
      )
      .order('created_at', {
        ascending: false,
      });

    if (profilesError) {
      console.error(
        'Admin profiles query error:',
        profilesError
      );

      throw new Error(
        'Unable to load users.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Get video counts and spending
     *
     * We retrieve user_id + cost so we can calculate:
     *
     * - Number of videos per user
     * - Credits spent per user
     * ---------------------------------------------------------
     */

    const {
      data: videos,
      error: videosError,
    } = await supabaseAdmin
      .from('user_videos')
      .select('user_id, cost');

    if (videosError) {
      console.error(
        'Admin user videos query error:',
        videosError
      );

      throw new Error(
        'Unable to load user generation statistics.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Build user generation statistics
     * ---------------------------------------------------------
     */

    const userVideoStats: Record<
      string,
      {
        videos: number;
        creditsSpent: number;
      }
    > = {};

    for (const video of videos || []) {
      if (!userVideoStats[video.user_id]) {
        userVideoStats[video.user_id] = {
          videos: 0,
          creditsSpent: 0,
        };
      }

      userVideoStats[video.user_id].videos += 1;

      userVideoStats[video.user_id].creditsSpent +=
        Number(video.cost || 0);
    }

    /*
     * ---------------------------------------------------------
     * 7. Get successful deposits per user
     * ---------------------------------------------------------
     */

    const {
      data: deposits,
      error: depositsError,
    } = await supabaseAdmin
      .from('wallet_deposits')
      .select(
        'user_id, amount, status'
      )
      .eq('status', 'successful');

    if (depositsError) {
      console.error(
        'Admin user deposits query error:',
        depositsError
      );

      throw new Error(
        'Unable to load user deposit statistics.'
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. Calculate deposits per user
     * ---------------------------------------------------------
     */

    const userDepositStats: Record<
      string,
      number
    > = {};

    for (const deposit of deposits || []) {
      if (!userDepositStats[deposit.user_id]) {
        userDepositStats[deposit.user_id] = 0;
      }

      userDepositStats[deposit.user_id] +=
        Number(deposit.amount || 0);
    }

    /*
     * ---------------------------------------------------------
     * 9. Combine everything
     * ---------------------------------------------------------
     */

    const users = (profiles || []).map(
      (profile) => {
        const videoStats =
          userVideoStats[profile.id] || {
            videos: 0,
            creditsSpent: 0,
          };

        const totalDeposited =
          userDepositStats[profile.id] || 0;

        return {
          id: profile.id,
          email: profile.email,
          credits: Number(
            profile.credits || 0
          ),
          created_at: profile.created_at,

          videosGenerated:
            videoStats.videos,

          creditsSpent:
            videoStats.creditsSpent,

          totalDeposited,
        };
      }
    );

    /*
     * ---------------------------------------------------------
     * 10. Return users
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      users,
      totalUsers: users.length,
    });
  } catch (error: any) {
    console.error(
      'Admin users API error:',
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Unable to load users.',
      },
      {
        status: 500,
      }
    );
  }
}