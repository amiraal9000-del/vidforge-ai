'use client';

import { useState } from 'react';
import { Upload, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import PublicNavbar from '@/components/PublicNavbar'; // ✅ Added

export default function VideoForge() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setVideoUrl(null);

    const formData = new FormData();
    formData.append('prompt', prompt);
    if (image) formData.append('image', image);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        toast.success("Video generation started!");
      } else {
        toast.error("Failed to start generation");
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <PublicNavbar /> {/* ✅ Navbar at the top — clean */}
      
      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 mt-8">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
              VidForge AI
            </h1>
            <p className="text-xl text-zinc-400">Turn your ideas into videos instantly</p>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-2">Describe your video</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A majestic dragon flying over a futuristic cyberpunk city at sunset..."
                  className="w-full h-32 bg-zinc-950 border border-zinc-700 rounded-2xl p-6 text-lg resize-y focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Upload reference image (optional)</label>
                <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-8 text-center hover:border-violet-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImage(e.target.files?.[0] || null)}
                    className="hidden"
                    id="image-upload"
                  />
                  <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-12 h-12 mb-4 text-zinc-500" />
                    <p className="text-lg">Click to upload image</p>
                    <p className="text-sm text-zinc-500 mt-1">Will help maintain character consistency</p>
                  </label>
                </div>
                {image && <p className="text-sm text-green-400 mt-2">✓ {image.name}</p>}
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" /> Generating Video...
                  </>
                ) : (
                  <>
                    <Play className="w-6 h-6" /> Generate Video
                  </>
                )}
              </button>
            </form>
          </div>

          {videoUrl && (
            <div className="mt-8">
              <h3 className="text-xl mb-4">Your Video</h3>
              <video src={videoUrl} controls className="w-full rounded-2xl" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}