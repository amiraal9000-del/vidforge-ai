'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Upload, Play, Loader2, Clock, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

const PRICING = {
  durations: [
    { seconds: 8, label: '8 sec', costWithAudio: 800, costSilent: 500 },
    { seconds: 15, label: '15 sec', costWithAudio: 1500, costSilent: 1200 },
    { seconds: 30, label: '30 sec', costWithAudio: 2800, costSilent: 2500 },
  ],
};

export default function ScriptGeneratePage() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(8);
  const [withAudio, setWithAudio] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState(0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  // Auth check + load credits
  useState(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);

      // Load credits from Supabase
      const { data } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();
      setUserCredits(data?.credits ?? 0);
      setLoadingUser(false);
    };
    init();
  });

  const selectedDuration = PRICING.durations.find(d => d.seconds === duration)!;
  const totalCost = withAudio ? selectedDuration.costWithAudio : selectedDuration.costSilent;
  const canAfford = userCredits >= totalCost;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt) return toast.error('Write your script first');
    if (!image) return toast.error('Upload a reference photo');
    if (!canAfford) return toast.error(`Need ₦${totalCost} — please top up`);

    setIsGenerating(true);
    setVideoUrl(null);

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('image', image);
    formData.append('duration', String(duration));
    formData.append('withAudio', String(withAudio));
    formData.append('cost', String(totalCost));

    try {
      const res = await fetch('/api/generate-script-video', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setVideoUrl(data.videoUrl);
      setUserCredits(data.remainingCredits);
      toast.success('Video created! 🎉');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <AppNavbar user={user} />
      
      <main className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6">
            <ArrowLeft size={16} /> Back to Dashboard
          </button>

          <h1 className="text-2xl font-bold mb-2">Photo + Script → Video</h1>
          <p className="text-zinc-400 mb-6">Turn your story into a short video</p>

          {/* Balance */}
          <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex justify-between items-center">
            <span>Your Balance: <strong className="text-emerald-400">₦{userCredits}</strong></span>
            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm">Top Up</button>
          </div>

          {!videoUrl ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Image Upload */}
              <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center">
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                    <button type="button" onClick={() => { setImage(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 bg-black/60 p-1 rounded-full">✕</button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload size={36} className="mx-auto text-zinc-500 mb-2" />
                    <p className="text-zinc-400">Click to upload reference photo</p>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}
              </div>

              {/* Script */}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your video scene by scene..."
                className="w-full h-36 p-4 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              />

              {/* Duration */}
              <div>
                <label className="flex items-center gap-2 mb-3 font-medium">
                  <Clock size={16} /> Video Length
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {PRICING.durations.map(opt => (
                    <button key={opt.seconds} type="button" onClick={() => setDuration(opt.seconds)}
                      className={`p-3 rounded-xl border transition ${
                        duration === opt.seconds ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-zinc-800'
                      }`}>
                      <div className="font-bold">{opt.label}</div>
                      <div className="text-xs text-zinc-400 mt-1">₦{opt.costWithAudio} / ₦{opt.costSilent}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Toggle */}
              <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2">
                  {withAudio ? <Volume2 size={18} className="text-violet-400" /> : <VolumeX size={18} className="text-zinc-500" />}
                  <span>AI Voice & Sound</span>
                </div>
                <button type="button" onClick={() => setWithAudio(!withAudio)}
                  className={`w-12 h-7 rounded-full transition ${withAudio ? 'bg-violet-600' : 'bg-zinc-700'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${withAudio ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Cost Summary */}
              <div className={`p-4 rounded-xl border ${canAfford ? 'bg-emerald-950/30 border-emerald-800' : 'bg-red-950/30 border-red-800'}`}>
                <div className="flex justify-between text-lg">
                  <span>Cost:</span>
                  <strong>₦{totalCost}</strong>
                </div>
                {!canAfford && <p className="text-red-400 text-sm mt-1">Need ₦{totalCost - userCredits} more</p>}
              </div>

              <button type="submit" disabled={isGenerating || !canAfford}
                className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2">
                {isGenerating ? <><Loader2 size={20} className="animate-spin" /> Creating...</> : <><Play size={20} /> Generate Video</>}
              </button>
            </form>
          ) : (
            <div className="p-6 bg-zinc-900 rounded-xl border border-violet-700 text-center">
              <h3 className="font-bold text-lg mb-4">✅ Your Video</h3>
              <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg" />
              <button onClick={() => { setVideoUrl(null); setPrompt(''); setImage(null); setImagePreview(null); }}
                className="mt-5 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg">Create Another</button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}