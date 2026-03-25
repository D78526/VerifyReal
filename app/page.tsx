'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-5), msg]);

  const runAnalysis = async () => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addLog("❌ Max file size: 10MB");
      return;
    }

    setLoading(true);
    setResult(null);
    setLogs([]);

    addLog("⚡ Initializing scan...");
    addLog("📤 Uploading...");

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 100));
      }

      if (!res.ok) throw new Error(data.error || "Request failed");

      addLog("🧠 AI analysis complete");
      setResult(data);

    } catch (e: any) {
      addLog("❌ " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-emerald-500 font-mono p-4 md:p-12">
      <div className="max-w-2xl mx-auto border border-emerald-900/50 bg-emerald-950/5 p-8 rounded-lg shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        
        <h1 className="text-3xl font-black mb-6">VerifyReal // GOD MODE</h1>

        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block w-full mb-6"
        />

        <button 
          onClick={runAnalysis}
          disabled={loading || !file}
          className="w-full py-4 bg-emerald-500 text-black font-bold"
        >
          {loading ? 'Scanning...' : 'Analyze'}
        </button>

        <div className="mt-4 text-xs space-y-1">
          {logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>

        {result && (
          <div className="mt-8">
            <div className="text-4xl font-bold">
              {result.riskScore}%
            </div>

            <div className="text-xl mt-2">
              {result.verdict}
            </div>

            <div className="w-full bg-gray-800 h-3 mt-4 rounded">
              <div
                className={`h-full ${result.riskScore > 60 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${result.riskScore}%` }}
              />
            </div>

            <div className="mt-4 text-xs opacity-70">
              {result.details.map((d: string, i: number) => (
                <div key={i}>{d}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}