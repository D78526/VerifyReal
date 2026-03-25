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

  const extractFrames = (videoFile: File): Promise<File[]> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);

      const frames: File[] = [];
      const points = [0.1, 0.3, 0.5, 0.7, 0.9];

      video.onloadedmetadata = async () => {
        for (let i = 0; i < points.length; i++) {
          video.currentTime = video.duration * points[i];
          await new Promise(r => (video.onseeked = r));

          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(video, 0, 0);

          const blob: Blob | null = await new Promise(res =>
            canvas.toBlob(res, 'image/jpeg', 0.7)
          );

          if (blob) {
            const compressed = await compressImage(
              new File([blob], `frame-${i}.jpg`, { type: 'image/jpeg' })
            );
            frames.push(compressed);
          }
        }

        resolve(frames);
      };
    });
  };

  const runAnalysis = async () => {
    if (!file) return;

    const limit = Number(localStorage.getItem("limit") || "0");
    if (limit >= 5) {
      addLog("⚠️ Free limit reached");
      return;
    }
    localStorage.setItem("limit", String(limit + 1));

    setLoading(true);
    setResult(null);
    setLogs([]);

    addLog("⚡ Initializing scan...");

    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("File too large (max 10MB)");
      }

      if (file.type.startsWith('video/')) {
        addLog("🎥 Extracting frames...");
        const frames = await extractFrames(file);

        let scores: number[] = [];

        for (let i = 0; i < frames.length; i++) {
          addLog(`🧠 Frame ${i + 1}/${frames.length}`);

          const formData = new FormData();
          formData.append('file', frames[i]);

          const res = await fetch('/api/verify', {
            method: 'POST',
            body: formData,
          });

          const text = await res.text();

          try {
            const data = JSON.parse(text);
            if (data?.riskScore !== undefined) {
              scores.push(data.riskScore);
            }
          } catch {}
        }

        if (scores.length === 0) {
          throw new Error("Video analysis failed");
        }

        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const peak = Math.max(...scores);
        const variance =
          scores.reduce((a, b) => a + Math.abs(b - avg), 0) / scores.length;

        let finalScore = avg * 0.4 + peak * 0.6;

        if (peak > 80) {
          finalScore = peak;
        }

        if (variance > 25) {
          finalScore += 10;
        }

        if (finalScore < 25 && peak > 40) {
          finalScore = peak * 0.75;
        }

        finalScore = Math.min(100, Math.round(finalScore));

        setResult({
          riskScore: finalScore,
          verdict:
            finalScore > 80
              ? "CRITICAL — AI GENERATED"
              : finalScore > 60
              ? "HIGH RISK — Synthetic Media"
              : finalScore > 40
              ? "UNCERTAIN — Needs Verification"
              : "LOW RISK — Likely Real",
          confidence: "Multi-frame AI analysis",
          details: [
            `Frames analyzed: ${scores.length}`,
            `Peak anomaly: ${Math.round(peak)}%`,
            `Consistency: ${Math.round(100 - variance)}%`
          ]
        });

        addLog("✅ Video analysis complete");
        return;
      }

      addLog("🗜️ Optimizing image...");
      const compressed = await compressImage(file);

      const formData = new FormData();
      formData.append('file', compressed);

      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Invalid server response");
      }

      if (!res.ok) throw new Error(data?.error);

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
          VerifyReal // GOD MODE
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

        <div className="mt-4 text-xs space-y-1 min-h-[80px]">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {result && (
          <div className="mt-6">
            <div className="text-4xl font-bold">{result.riskScore}%</div>
            <div className="text-lg">{result.verdict}</div>
            <div className="text-xs opacity-60">{result.confidence}</div>

            <div className="mt-3 text-xs space-y-1">
              {result.details?.map((r: string, i: number) => (
                <div key={i}>• {r}</div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}