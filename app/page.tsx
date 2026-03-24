'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);

  const extractFrame = (videoFile: File): Promise<File> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(2, video.duration / 2);
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], 'frame.jpg', { type: 'image/jpeg' }));
        });
      };
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setRiskScore(null);
    setExplanation('');

    let fileToSend = file;

    if (file.type.startsWith('video/')) {
      fileToSend = await extractFrame(file); // back to 1 frame (stable)
    }

    const formData = new FormData();
    formData.append('file', fileToSend);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      setRiskScore(data.riskScore);
      setExplanation(data.explanation);
    } catch {
      setExplanation("Request failed");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <h1 className="text-6xl font-bold text-center mb-4">VerifyReal ✓</h1>
      <p className="text-center text-2xl mb-12">Deepfake Risk Score 0–100%</p>

      <input
        type="file"
        accept="image/*,video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block mx-auto mb-8 text-lg"
      />

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="bg-green-600 px-12 py-6 rounded-2xl text-2xl mx-auto block font-bold"
      >
        {loading ? 'Analyzing...' : 'Get Risk Score'}
      </button>

      {riskScore !== null && (
        <div className="mt-16 text-center max-w-md mx-auto">
          <div className="text-8xl font-bold mb-3">{riskScore}%</div>

          <div className={`text-4xl font-bold ${riskScore > 60 ? 'text-red-500' : 'text-green-500'}`}>
            {riskScore > 60 ? 'HIGH RISK' : 'LOW RISK'}
          </div>

          <p className="mt-8 text-xl">{explanation}</p>
        </div>
      )}
    </div>
  );
}