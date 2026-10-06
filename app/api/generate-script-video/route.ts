import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const image = formData.get('image') as File | null;
    const duration = parseInt(formData.get('duration') as string);
    const withAudio = formData.get('withAudio') === 'true';
    const cost = parseInt(formData.get('cost') as string);

    // 1. Get authenticated user
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    // 2. Check & deduct credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (!profile || profile.credits < cost) {
      return NextResponse.json({ error: 'Insufficient credits — please top up' }, { status: 402 });
    }

    // 3. Upload image to Supabase Storage
    let imageUrl = '';
    if (image) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = path.extname(image.name) || '.jpg';
      const fileName = `${uuidv4()}${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('input-images')
        .upload(`${user.id}/${fileName}`, buffer, {
          contentType: image.type,
          upsert: false
        });

      if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from('input-images')
        .getPublicUrl(uploadData.path);

      imageUrl = publicUrl;
    }

    // 4. Call OpenRouter to generate video
    const openRouterPayload = {
      model: 'google/veo-3.1-lite',
      prompt: `${prompt}\n\nReference image: ${imageUrl}`,
      max_duration: duration,
      audio: withAudio
    };

    const orResponse = await fetch('https://openrouter.ai/api/v1/video/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      },
      body: JSON.stringify(openRouterPayload)
    });

    const orResult = await orResponse.json();
    if (!orResponse.ok) throw new Error(orResult.error?.message || 'Video generation failed');

    const videoUrl = orResult.video_url || orResult.output?.video;
    if (!videoUrl) throw new Error('No video URL returned from AI');

    // 5. Deduct credits ONLY after success
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ credits: profile.credits - cost })
      .eq('id', user.id);

    if (deductError) throw new Error('Failed to update balance');

    // 6. Save video record
    await supabase.from('user_videos').insert({
      user_id: user.id,
      prompt,
      image_url: imageUrl,
      video_url: videoUrl,
      duration,
      cost,
      has_audio: withAudio
    });

    // 7. Return success
    return NextResponse.json({
      success: true,
      videoUrl,
      remainingCredits: profile.credits - cost
    });

  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}