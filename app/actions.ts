'use server';

export async function createGeneration(formData: FormData) {
  const prompt = formData.get('prompt') as string;
  const image = formData.get('image') as File | null;

  return {
    id: 'gen_' + Date.now(),
    prompt,
    has_image: !!image,
    status: 'queued',
    model_used: 'fal-kling',
    created_at: new Date().toISOString(),
  };
}