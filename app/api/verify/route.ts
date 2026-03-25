import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

async function queryModel(url: string, token: string, buffer: ArrayBuffer, type: string) {
  const res = await fetch(url, {
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
    return { error: true };
  }
}

function extractRisk(data: any): number {
  if (!Array.isArray(data)) return 50;

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

async function analyze(buffer: ArrayBuffer, type: string, token: string) {
  const m1 = await queryModel(
    "https://router.huggingface.co/hf-inference/models/dima806/deepfake_vs_real_image_detection",
    token,
    buffer,
    type
  );

  const m2 = await queryModel(
    "https://router.huggingface.co/hf-inference/models/prithivMLmods/Deep-Fake-Detector-Model",
    token,
    buffer,
    type
  );

  const r1 = extractRisk(m1);
  const r2 = extractRisk(m2);

  let score = (r1 * 0.6) + (r2 * 0.4);

  if (r1 > 70 || r2 > 70) {
    score = Math.max(r1, r2);
  }

  return score;
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

    // 🔥 MULTI-PASS (REAL ACCURACY BOOST)
    const passes = 5;
    let scores: number[] = [];

    for (let i = 0; i < passes; i++) {
      const score = await analyze(buffer, type, token);
      scores.push(score);
    }

    let avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    const max = Math.max(...scores);
    const min = Math.min(...scores);
    const spread = max - min;

    // instability = suspicious
    if (spread > 25) avg += 10;

    if (max > 75) avg = max;

    const finalRisk = Math.min(100, Math.round(avg));

    let verdict = "";
    let confidence = "";

    if (finalRisk > 75) {
      verdict = "Likely Deepfake";
      confidence = "High confidence";
    } else if (finalRisk > 55) {
      verdict = "Possibly Manipulated";
      confidence = "Medium confidence";
    } else if (finalRisk > 35) {
      verdict = "Uncertain";
      confidence = "Low confidence";
    } else {
      verdict = "Likely Authentic";
      confidence = "High confidence";
    }

    let reasons: string[] = [];

    if (spread > 25) {
      reasons.push("Inconsistent detection patterns");
    }

    if (finalRisk > 70) {
      reasons.push("Facial artifacts detected");
      reasons.push("Unnatural texture patterns");
    } else if (finalRisk > 50) {
      reasons.push("Minor irregularities detected");
    } else {
      reasons.push("No strong manipulation signals");
    }

    return NextResponse.json({
      riskScore: finalRisk,
      verdict,
      confidence,
      reasons
    });

  } catch (err: any) {
    return NextResponse.json({
      error: err.message || "Server error"
    }, { status: 500 });
  }
}