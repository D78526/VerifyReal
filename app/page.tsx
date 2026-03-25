'use client';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setStatus('Initializing Neural Engine...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      setStatus('Uploading to Global Nodes...');
      const res = await fetch('/api/verify', { method: 'POST', body: formData });
      setStatus('Scanning Spectral Artifacts...');
      const result = await res.json();
      
      if (result.error) throw new Error(result.error);
      setData(result);
    } catch (e) {
      setStatus('Error: Connection Timed Out');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 font-mono flex flex-col items-center justify-center">
      {/* ELITE HEADER */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-black tracking-tighter mb-2 italic">VERIFY_REAL.v2</h1>
        <div className="h-1 w-32 bg-emerald-500 mx-auto rounded-full"></div>
      </div>

      {/* DROPZONE */}
      <div className="w-full max-w-xl bg-[#111] border border-white/10 p-8 rounded-2xl shadow-2xl">
        <input 
          type="file" 
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full mb-6 text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-emerald-500 file:text-black file:font-bold hover:file:bg-emerald-400 cursor-pointer"
        />

        <button
          onClick={handleAnalyze}
          disabled={loading || !file}
          className="w-full bg-white text-black py-4 font-black rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? status.toUpperCase() : 'RUN DIAGNOSTICS'}
        </button>
      </div>

      {/* RESULTS TABLE */}
      {data && (
        <div className="w-full max-w-xl mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className={`p-6 rounded-2xl border-2 ${data.riskScore > 60 ? 'border-red-500 bg-red-500/5' : 'border-emerald-500 bg-emerald-500/5'}`}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm uppercase tracking-widest font-bold opacity-70">Analysis Verdict</span>
              <span className="text-xs bg-white/10 px-2 py-1 rounded">Confidence: {data.confidence}</span>
            </div>
            <div className="text-4xl font-black mb-1">{data.verdict}</div>
            <div className="text-6xl font-black text-white/20 mb-6">{data.riskScore}% <span className="text-lg tracking-normal opacity-50">RISK</span></div>
            
            <div className="space-y-2 border-t border-white/10 pt-4">
              {data.reasons.map((r: string, i: number) => (
                <div key={i} className="text-xs text-gray-400">» {r}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}