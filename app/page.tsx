'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-5), msg]);
  };

  const extractFrame = (videoFile: File): Promise<File> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        video.currentTime = video.duration / 2;
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

  const runAnalysis = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setLogs([]);

    addLog("⚡ Initializing scan...");

    let fileToSend = file;

    try {
      if (file.type.startsWith('video/')) {
        addLog("🎥 Extracting frame...");
        fileToSend = await extractFrame(file);
      }

      addLog("📤 Uploading...");
      const formData = new FormData();
      formData.append('file', fileToSend);

      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      addLog("🧠 AI analyzing...");
      addLog("📊 Finalizing...");

      setResult(data);
      addLog("✅ Done");

    } catch (e: any) {
      addLog(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-emerald-500 font-mono p-6">

      <div className="max-w-2xl mx-auto border border-emerald-900 p-8 rounded-lg">

        <h1 className="text-3xl font-bold mb-6">VerifyReal</h1>

        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-4 w-full"
        />

        <button
          onClick={runAnalysis}
          disabled={loading || !file}
          className="w-full bg-emerald-500 text-black py-3 font-bold"
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>

        <div className="mt-4 text-xs">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {result && (
          <div className="mt-6">

            <h2 className="text-2xl">{result.riskScore}%</h2>
            <p>{result.verdict}</p>
            <p className="text-xs">{result.confidence}</p>

            <ul className="text-xs mt-2">
              {result.reasons.map((r: string, i: number) => (
                <li key={i}>• {r}</li>
              ))}
            </ul>

          </div>
        )}

      </div>
    </div>
  );
}