'use server';

export async function createGeneration(formData: FormData) {
  const prompt = formData.get('prompt') as string;
  const imageUrl = formData.get('imageUrl') as string | null;

  return {
    id: 'gen_' + Date.now(),
    prompt,
    image_url: imageUrl,
    status: 'queued',
    model_used: 'fal-kling',
    created_at: new Date().toISOString(),
  };
}