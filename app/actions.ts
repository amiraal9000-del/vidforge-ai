'use server';

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function createGeneration(prompt: string, imageUrl?: string | null) {
  const cookieStore = cookies();
  const supabase = createServerComponentClientClient({ cookies: () => cookieStore });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('generations')
    .insert({
      user_id: user.id,
      prompt,
      image_url: imageUrl,
      status: 'queued',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}