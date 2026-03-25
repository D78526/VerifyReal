'use client';
import { useState, useRef } from 'react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setProgress(10);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/verify', { method: 'POST', body: formData });
      const data = await res.json();
      setProgress(100);
      setResult(data);
    } catch (e) {
      console.error("Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 selection:bg-emerald-500/30 font-sans">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-emerald-900/20 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-20">
        <header className="text-center mb-16">
          <div className="inline-block px-3 py-1 mb-4 rounded-full border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-xs font-medium tracking-widest uppercase">
            Global Media Verification Standard
          </div>
          <h1 className="text-7xl font-extrabold tracking-tighter mb-4 bg-gradient-to-b from-white to-gray-500 bg-clip-text text-transparent">
            VerifyReal<span className="text-emerald-500">.</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Leveraging neural networks to detect synthetic manipulation and deepfake artifacts in digital media.
          </p>
        </header>

        {/* Upload Zone */}
        <section className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl py-12 px-4 transition-colors hover:border-emerald-500/50">
            <input 
              type="file" 
              className="hidden" 
              id="file-upload" 
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="file-upload" className="cursor-pointer text-center">
              <span className="block text-4xl mb-4">📁</span>
              <span className="text-lg font-medium block">{file ? file.name : "Select Media Asset"}</span>
              <span className="text-sm text-gray-500 mt-2 block italic">Supports JPG, PNG, MP4</span>
            </label>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 text-black font-bold py-4 rounded-xl transition-all transform active:scale-[0.98] shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            {loading ? `SCANNIG... ${progress}%` : 'INITIALIZE ANALYSIS'}
          </button>
        </section>

        {/* Results View */}
        {result && (
          <section className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center">
              <div className="relative w-40 h-40">
                 <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#1f2937" strokeWidth="8" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke={result.riskScore > 60 ? "#ef4444" : "#10b981"} 
                            strokeWidth="8" strokeDasharray="283" strokeDashoffset={283 - (283 * result.riskScore) / 100} 
                            strokeLinecap="round" className="transition-all duration-1000" />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold">{result.riskScore}%</span>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Risk Index</span>
                 </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
              <h3 className="text-emerald-500 text-xs font-bold uppercase tracking-widest mb-4">Verification Report</h3>
              <div className="text-3xl font-bold mb-2">{result.verdict}</div>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                {result.riskScore > 50 
                  ? "Analysis suggests high probability of algorithmic generation. Metadata and noise patterns are inconsistent with organic capture."
                  : "Media aligns with standard authentic capture patterns. No significant synthetic artifacts detected."}
              </p>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${result.isConsistent ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                  {result.isConsistent ? "HIGH CONSISTENCY" : "LOW CONSISTENCY"}
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}