'use server';

// VidForge AI — Server Action
// Supabase integration will be restored via @supabase/ssr when npm install is available
export async function createGeneration(prompt: string, imageUrl?: string | null) {
  return {
    id: 'gen_' + Date.now(),
    prompt,
    image_url: imageUrl || null,
    status: 'queued',
    model_used: 'fal-kling',
    created_at: new Date().toISOString(),
  };
}