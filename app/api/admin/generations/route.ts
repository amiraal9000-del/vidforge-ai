import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const ADMIN_EMAIL = "Calibossmfr01@gmail.com";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Check logged-in user
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // No cookie changes needed for this read-only admin API.
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Admin-only access
    if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    // Get all generated videos
    const { data: videos, error: videosError } = await supabaseAdmin
      .from("user_videos")
      .select(
        `
        id,
        user_id,
        prompt,
        image_url,
        video_url,
        duration,
        cost,
        has_audio,
        created_at
        `
      )
      .order("created_at", { ascending: false });

    if (videosError) {
      console.error("Admin generations query error:", videosError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load generations",
        },
        { status: 500 }
      );
    }

    // Get user emails
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, email");

    if (profilesError) {
      console.error("Admin profiles query error:", profilesError);

      return NextResponse.json(
        {
          success: false,
          error: "Failed to load user information",
        },
        { status: 500 }
      );
    }

    const emailMap = new Map(
      (profiles || []).map((profile) => [
        profile.id,
        profile.email || "Unknown user",
      ])
    );

    // Attach email to every generation
    const generations = (videos || []).map((video) => ({
      id: video.id,
      user_id: video.user_id,
      email: emailMap.get(video.user_id) || "Unknown user",
      prompt: video.prompt || "",
      image_url: video.image_url || null,
      video_url: video.video_url,
      duration: video.duration || 0,
      cost: video.cost || 0,
      has_audio: video.has_audio ?? true,
      created_at: video.created_at,
    }));

    // Overall generation statistics
    const totalGenerations = generations.length;

    const totalCreditsSpent = generations.reduce(
      (total, video) => total + Number(video.cost || 0),
      0
    );

    const audioGenerations = generations.filter(
      (video) => video.has_audio
    ).length;

    const silentGenerations = generations.filter(
      (video) => !video.has_audio
    ).length;

    const duration4 = generations.filter(
      (video) => Number(video.duration) === 4
    ).length;

    const duration6 = generations.filter(
      (video) => Number(video.duration) === 6
    ).length;

    const duration8 = generations.filter(
      (video) => Number(video.duration) === 8
    ).length;

    return NextResponse.json({
      success: true,
      generations,
      summary: {
        totalGenerations,
        totalCreditsSpent,
        audioGenerations,
        silentGenerations,
        duration4,
        duration6,
        duration8,
      },
    });
  } catch (error) {
    console.error("Admin generations API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 }
    );
  }
}