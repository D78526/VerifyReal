import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function fetchWithTimeout(url: string, options: any, timeout = 12000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    )
  ]);
}

async function queryModel(url: string, token: string, buffer: ArrayBuffer, type: string) {
  try {
    const res: any = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": type || "application/octet-stream",
      },
      body: buffer,
    });

    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function extractRisk(data: any): number | null {
  if (!data || !Array.isArray(data)) return null;

  let results = data;
  if (Array.isArray(data[0])) results = data[0];

  const fake = results.find((r: any) =>
    r.label?.toLowerCase().includes("fake")
  );

  if (fake) return fake.score * 100;

  const top = results.reduce((a: any, b: any) =>
    a.score > b.score ? a : b
  );

  return (1 - top.score) * 100;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      return NextResponse.json({ error: "Missing HF token" }, { status: 500 });
    }

    const buffer = await file.arrayBuffer();
    const type = file.type;

    const [m1, m2] = await Promise.all([
      queryModel(
        "https://router.huggingface.co/hf-inference/models/dima806/deepfake_vs_real_image_detection",
        token,
        buffer,
        type
      ),
      queryModel(
        "https://router.huggingface.co/hf-inference/models/prithivMLmods/Deep-Fake-Detector-Model",
        token,
        buffer,
        type
      )
    ]);

    const r1 = extractRisk(m1);
    const r2 = extractRisk(m2);

    // 🧠 GOD MODE SCORING
    let signals: number[] = [];

    if (r1 !== null) signals.push(r1);
    if (r2 !== null) signals.push(r2);

    let avg = signals.length
      ? signals.reduce((a, b) => a + b, 0) / signals.length
      : 50;

    let peak = signals.length ? Math.max(...signals) : 50;
    let spread =
      signals.length > 1 ? Math.abs(signals[0] - signals[1]) : 0;

    let finalRisk = avg * 0.5 + peak * 0.5;

    if (peak > 75) {
      finalRisk = peak;
    }

    if (spread > 40) {
      finalRisk += 10;
    }

    if (finalRisk < 25 && peak > 40) {
      finalRisk = peak * 0.7;
    }

    if (finalRisk < 30 && avg < 25) {
      finalRisk *= 0.85;
    }

    finalRisk = Math.min(100, Math.round(finalRisk));

    let verdict = "";

    if (finalRisk > 80) {
      verdict = "CRITICAL — AI GENERATED";
    } else if (finalRisk > 60) {
      verdict = "HIGH RISK — Synthetic Media";
    } else if (finalRisk > 40) {
      verdict = "UNCERTAIN — Needs Verification";
    } else {
      verdict = "LOW RISK — Likely Real";
    }

    return NextResponse.json({
      riskScore: finalRisk,
      verdict,
      confidence: "Multi-model AI analysis"
    });

  } catch (err: any) {
    return NextResponse.json({
      error: err.message || "Server error"
    }, { status: 500 });
  }
}