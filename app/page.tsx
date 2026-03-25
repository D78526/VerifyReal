'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [verdict, setVerdict] = useState('');
  const [confidence, setConfidence] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Extract frame from video
  const extractFrame = (videoFile: File): Promise<File> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        video.currentTime = 1;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], 'frame.jpg', { type: 'image/jpeg' }));
          }
        });
      };
    });
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setProgress(0);
    setRiskScore(null);

    const interval = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 5 : p));
    }, 200);

    let fileToSend = file;

    if (file.type.startsWith('video/')) {
      fileToSend = await extractFrame(file);
    }

    const formData = new FormData();
    formData.append('file', fileToSend);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      clearInterval(interval);
      setProgress(100);

      setRiskScore(data.riskScore);
      setVerdict(data.verdict);
      setConfidence(data.confidence);
      setReasons(data.reasons);
    } catch {
      clearInterval(interval);
      setVerdict("Error");
      setConfidence("");
      setReasons(["Request failed"]);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">

      <h1 className="text-6xl font-bold text-center mb-2">
        VerifyReal ✓
      </h1>

      <p className="text-center text-lg text-gray-400 mb-12">
        AI-powered deepfake detection for images & video
      </p>

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

      {/* Progress */}
      {loading && (
        <div className="mt-6 max-w-md mx-auto">
          <div className="h-4 bg-gray-700 rounded">
            <div
              className="h-4 bg-green-500 rounded transition-all"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center mt-2 text-sm">
            Scanning media with AI...
          </p>
        </div>
      )}

      {/* Result */}
      {riskScore !== null && (
        <div className="mt-16 text-center max-w-md mx-auto">

          {/* Circle */}
          <div className="relative w-48 h-48 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-8 border-gray-700"></div>

            <div
              className={`absolute inset-0 rounded-full border-8 ${
                riskScore > 60 ? 'border-red-500' : 'border-green-500'
              }`}
              style={{
                clipPath: `inset(${100 - riskScore}% 0 0 0)`
              }}
            ></div>

            <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold">
              {riskScore}%
            </div>
          </div>

          {/* Verdict */}
          <div className="text-3xl font-bold mb-2">
            {verdict}
          </div>

          <div className="text-gray-400 mb-6">
            {confidence}
          </div>

          {/* Analysis */}
          <div className="text-left bg-gray-900 p-6 rounded-2xl">
            <h3 className="text-lg font-semibold mb-3">
              Analysis
            </h3>

            <ul className="space-y-2 text-gray-300">
              {reasons.map((r, i) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>
          </div>

          {/* Share */}
          <button
            onClick={() => {
              const text = `VerifyReal: ${riskScore}% risk — ${verdict}`;
              window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`);
            }}
            className="mt-8 bg-blue-600 px-6 py-3 rounded-xl"
          >
            Share Result
          </button>

        </div>
      )}
    </div>
  );
}