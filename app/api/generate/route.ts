import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fal } from '@fal-ai/client';
import Replicate from 'replicate';

fal.config({ credentials: process.env.FAL_KEY });

const replicate = new Replicate({
auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
try {
const formData = await request.formData();
const prompt = formData.get('prompt') as string;
const imageFile = formData.get('image') as File | null;

const userId = 'test-user-' + Date.now();

let imageUrl: string | null = null;

if (imageFile) {
const fileExt = imageFile.name.split('.').pop();
const fileName = `${userId}/${Date.now()}.${fileExt}`;

const { error } = await supabase.storage
.from('input-images')
.upload(fileName, imageFile);

if (error) throw error;

imageUrl = supabase.storage.from('input-images').getPublicUrl(fileName).data.publicUrl;
}

const { data: generation } = await supabase
.from('generations')
.insert({
prompt,
input_image_url: imageUrl,
status: 'pending',
})
.select()
.single();

let provider = 'fal';

try {
// Fal.ai attempt
const result = await fal.queue.submit('fal-ai/kling-video/v2.1/standard/text-to-video', {
  input: {
    prompt,
    image_url: imageUrl || undefined,
    duration: 5,
    aspect_ratio: "16:9",
  }
});

await supabase.from('generations').update({
fal_request_id: result.requestId,
status: 'processing',
model_used: 'fal-kling'
}).eq('id', generation.id);

} catch (falError) {
console.log("Fal failed → Using Replicate fallback");

provider = 'replicate';

// Confirmed working model on Replicate
const output = await replicate.run(
"minimax/video-01",
{
input: {
prompt: prompt,
}
}
);

const videoUrl = Array.isArray(output) ? output[0] : output;

await supabase.from('generations').update({
output_video_url: videoUrl as string,
status: 'completed',
model_used: 'replicate-minimax-video-01'


}).eq('id', generation.id);
}

return Response.json({
success: true,
generationId: generation.id,
provider
});

} catch (error: any) {
console.error('Error:', error);
return Response.json({ error: error.message }, { status: 500 });
}
}