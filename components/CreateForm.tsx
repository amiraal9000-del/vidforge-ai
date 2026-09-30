'use client';

import { useState } from 'react';
import { createGeneration } from '@/app/actions';

export default function CreateForm() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('prompt', prompt);
    if (image) formData.append('image', image);

    await createGeneration(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A serene mountain lake at sunrise with flying dragons..."
        className="w-full h-32 p-4 border rounded-xl"
      />
      <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} />
      <button type="submit" className="w-full bg-violet-600 text-white py-4 rounded-xl font-medium">
        Generate Video ✨
      </button>
    </form>
  );
}