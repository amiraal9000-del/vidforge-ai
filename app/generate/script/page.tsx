'use client';
import { useState, useEffect, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Upload, Play, Loader2, Clock, Volume2, VolumeX, ArrowLeft, CheckCircle, AlertCircle, Mic, Eye } from 'lucide-react';
import { toast } from 'sonner';
import AppNavbar from '@/components/AppNavbar';

// PRICING: All values = CREDITS, NOT NAIRA
const PRICING = {
  durations: [
    { seconds: 8, label: '8 sec (Reel)', costWithAudio: 80, costSilent: 50 },
    { seconds: 15, label: '15 sec', costWithAudio: 150, costSilent: 120 },
    { seconds: 30, label: '30 sec', costWithAudio: 280, costSilent: 250 },
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
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const wordCount = prompt.trim() ? prompt.trim().split(/\s+/).length : 0;

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return router.push('/login');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      setUser(user);

      const { data } = await supabase
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();
      setUserCredits(data?.credits ?? 0);
      setLoadingUser(false);
    };
    init();
  }, [supabase, router]);

  const selectedDuration = PRICING.durations.find(d => d.seconds === duration)!;
  const totalCost = withAudio ? selectedDuration.costWithAudio : selectedDuration.costSilent;
  const canAfford = userCredits >= totalCost;
  
  // Estimate: average speaking rate = ~150 words per minute
  const estimatedSpeechSeconds = wordCount > 0 ? Math.ceil((wordCount / 150) * 60) : 0;
  const scriptFits = estimatedSpeechSeconds <= duration;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePreviewVoice = async () => {
    if (!prompt.trim()) return toast.error('Write something first to preview');
    if (!withAudio) return toast.info('Enable AI Voice first to hear a preview');
    
    setIsPreviewingVoice(true);
    try {
      const utterance = new SpeechSynthesisUtterance(prompt);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      window.speechSynthesis.speak(utterance);
      toast.success('🔊 Speaking now...');
    } catch {
      toast.error('Voice preview not available on this browser');
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const stopPreview = () => {
    window.speechSynthesis.cancel();
    setIsPreviewingVoice(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReview) {
      setShowReview(true);
      return;
    }

    if (!prompt) return toast.error('Write your script first');
    if (!image) return toast.error('Upload a reference photo');
    if (!canAfford) return toast.error(`Need ${totalCost} credits — please top up`);
    if (!scriptFits && withAudio) {
      toast.warning(`Script may be too long — estimated ${estimatedSpeechSeconds}s vs ${duration}s selected`);
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setShowReview(false);

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('image', image);
    formData.append('duration', String(duration));
    formData.append('withAudio', String(withAudio));
    formData.append('cost', String(totalCost));

    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token;
      
      const res = await fetch('/api/generate-script-video', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setVideoUrl(data.videoUrl);
      setUserCredits(data.remainingCredits);
      toast.success('🎉 Your video is ready!');
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
          <p className="text-zinc-400 mb-6">Write your story, preview it, then create your video</p>

          {/* BALANCE — CLEARLY SHOWS CREDITS */}
          <div className="mb-6 p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex justify-between items-center">
            <span>Your Balance: <strong className="text-emerald-400 text-lg">{userCredits} Credits</strong></span>
            <button onClick={() => router.push('/top-up')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium">Top Up</button>
          </div>

          {!videoUrl ? (
            <>
              {!showReview ? (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Image Upload */}
                  <div className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center">
                    {imagePreview ? (
                      <div className="relative">
                        <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                        <button type="button" onClick={() => { setImage(null); setImagePreview(null); }}
                          className="absolute top-2 right-2 bg-black/60 p-1 rounded-full hover:bg-black/80">✕</button>
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
                  <div>
                    <label className="block mb-2 font-medium">Your Script</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe your video scene by scene..."
                      className="w-full h-36 p-4 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <div className="flex justify-between items-center mt-2 text-sm text-zinc-400">
                      <span>{wordCount} words</span>
                      {withAudio && wordCount > 0 && (
                        <span className={scriptFits ? 'text-emerald-400' : 'text-amber-400'}>
                          Est. {estimatedSpeechSeconds}s {scriptFits ? '✓ fits' : '⚠️ longer than selected'}
                        </span>
                      )}
                    </div>
                    
                    {/* Voice Preview */}
                    {withAudio && (
                      <div className="mt-3 flex gap-3">
                        <button 
                          type="button" 
                          onClick={isPreviewingVoice ? stopPreview : handlePreviewVoice}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                            isPreviewingVoice ? 'bg-red-600 hover:bg-red-500' : 'bg-violet-600/20 hover:bg-violet-600/40 text-violet-300'
                          }`}
                        >
                          <Mic size={16} />
                          {isPreviewingVoice ? 'Stop Preview' : '🔊 Preview Voice'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Duration — NOW SHOWS CREDITS NOT NAIRA */}
                  <div>
                    <label className="flex items-center gap-2 mb-3 font-medium">
                      <Clock size={16} /> Video Length
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {PRICING.durations.map(opt => (
                        <button key={opt.seconds} type="button" onClick={() => setDuration(opt.seconds)}
                          className={`p-3 rounded-xl border transition ${
                            duration === opt.seconds ? 'border-violet-500 bg-violet-500/10 text-violet-400' : 'border-zinc-800 hover:border-zinc-600'
                          }`}>
                          <div className="font-bold">{opt.label}</div>
                          <div className="text-xs text-zinc-400 mt-1">{opt.costWithAudio} cr / {opt.costSilent} cr</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audio Toggle */}
                  <div className="flex items-center justify-between p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                      {withAudio ? <Volume2 size={18} className="text-violet-400" /> : <VolumeX size={18} className="text-zinc-500" />}
                      <span>AI Voice & Background Music</span>
                    </div>
                    <button type="button" onClick={() => setWithAudio(!withAudio)}
                      className={`w-12 h-7 rounded-full transition ${withAudio ? 'bg-violet-600' : 'bg-zinc-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${withAudio ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>

                  {/* COST SUMMARY — ALL CREDITS NOW */}
                  <div className={`p-4 rounded-xl border ${canAfford ? 'bg-emerald-950/30 border-emerald-800' : 'bg-red-950/30 border-red-800'}`}>
                    <div className="flex justify-between text-lg">
                      <span>Cost:</span>
                      <strong>{totalCost} Credits</strong>
                    </div>
                    {!canAfford && <p className="text-red-400 text-sm mt-1">Need {totalCost - userCredits} more credits — please top up</p>}
                    {!scriptFits && withAudio && <p className="text-amber-400 text-sm mt-1">⚠️ Script may exceed selected duration</p>}
                  </div>

                  <button type="submit" disabled={!image || !prompt.trim() || !canAfford}
                    className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                    <Eye size={20} /> Review & Continue
                  </button>
                </form>
              ) : (
                // === REVIEW & CONFIRM STEP ===
                <div className="space-y-6">
                  <div className="text-center mb-4">
                    <CheckCircle size={40} className="mx-auto text-emerald-400 mb-2" />
                    <h2 className="text-xl font-bold">Review Your Project</h2>
                    <p className="text-zinc-400 text-sm">Please confirm everything is correct before creating</p>
                  </div>

                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
                    <div>
                      <span className="text-zinc-400 text-sm">Reference Photo</span>
                      <img src={imagePreview!} alt="Review" className="w-full max-h-40 object-cover rounded-lg mt-2" />
                    </div>
                    
                    <div>
                      <span className="text-zinc-400 text-sm">Script</span>
                      <p className="mt-1 text-sm bg-zinc-950 p-3 rounded-lg">{prompt}</p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-zinc-400">Duration</span>
                        <p className="font-semibold">{selectedDuration.label}</p>
                      </div>
                      <div>
                        <span className="text-zinc-400">Audio</span>
                        <p className="font-semibold">{withAudio ? '✅ With Voice' : '❌ Silent'}</p>
                      </div>
                    </div>
                    
                    <div className="border-t border-zinc-800 pt-4 flex justify-between items-center">
                      <span className="text-zinc-400">Your Balance: {userCredits} Credits</span>
                      <span className="text-xl font-bold text-emerald-400">−{totalCost} Credits</span>
                    </div>
                    
                    <div className="flex justify-between items-center text-lg font-semibold">
                      <span>After Creation</span>
                      <span className="text-emerald-400">{userCredits - totalCost} Credits</span>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setShowReview(false)}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition">
                      ← Go Back
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={isGenerating}
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                      {isGenerating ? (
                        <><Loader2 size={18} className="animate-spin" /> Creating...</>
                      ) : (
                        <><Play size={18} /> Confirm & Create</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // === RESULT: VIDEO READY ===
            <div className="p-6 bg-zinc-900 rounded-xl border border-violet-700 text-center">
              <h3 className="font-bold text-lg mb-4">✅ Your Video Is Ready</h3>
              <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg" />
              <div className="mt-5 flex gap-3">
                <button onClick={() => { 
                  setVideoUrl(null); 
                  setPrompt(''); 
                  setImage(null); 
                  setImagePreview(null); 
                  setShowReview(false); 
                }}
                  className="flex-1 py-3 bg-violet-600/20 hover:bg-violet-600/40 rounded-xl font-medium transition">
                  Create Another
                </button>
                <button onClick={() => router.push('/dashboard')}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium transition">
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}