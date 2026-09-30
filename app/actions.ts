'use server';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export async function createGeneration(prompt: string, imageUrl?: string | null) {
  const supabase = createClientComponentClient();
  
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