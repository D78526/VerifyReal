'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-6), msg]);
  };

  // 🔥 Compress image (prevents HF crash)
  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);

      img.onload = () => {
        const canvas = document.createElement('canvas');

        const maxSize = 512;
        let { width, height } = img;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], 'compressed.jpg', { type: 'image/jpeg' }));
          }
        }, 'image/jpeg', 0.7);
      };
    });
  };

  // 🔥 Extract + compress video frame
  const extractFrame = (videoFile: File): Promise<File> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);

      video.onloadedmetadata = () => {
        video.currentTime = video.duration / 2;
      };

      video.onseeked = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
          if (blob) {
            const frame = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
            const compressed = await compressImage(frame);
            resolve(compressed);
          }
        }, 'image/jpeg', 0.8);
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
      // 🔥 HARD LIMIT
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File too large (max 10MB)");
      }

      if (file.type.startsWith('video/')) {
        addLog("🎥 Extracting frame...");
        fileToSend = await extractFrame(file);
      } else {
        addLog("🗜️ Compressing image...");
        fileToSend = await compressImage(file);
      }

      addLog("📤 Uploading...");

      const formData = new FormData();
      formData.append('file', fileToSend);

      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      // 🔥 SAFE PARSE (NO MORE CRASHES)
      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Server returned invalid response");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Request failed");
      }

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

        <h1 className="text-3xl font-bold mb-6">
          VerifyReal // Unstoppable
        </h1>

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

        {/* LOGS */}
        <div className="mt-4 text-xs space-y-1 min-h-[80px]">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {/* RESULT */}
        {result && (
          <div className="mt-6">

            <div className="text-4xl font-bold">
              {result.riskScore}%
            </div>

            <div className="mt-1 text-lg">
              {result.verdict}
            </div>

            <div className="text-xs opacity-60">
              {result.confidence}
            </div>

            <div className="mt-3 text-xs space-y-1">
              {result.reasons?.map((r: string, i: number) => (
                <div key={i}>• {r}</div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}