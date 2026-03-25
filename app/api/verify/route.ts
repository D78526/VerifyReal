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
    return { error: "Non-JSON", raw: text };
  }
}

function extractRisk(data: any): number {
  if (!Array.isArray(data)) return 50;

  let results = data;

  if (Array.isArray(data[0])) {
    results = data[0];
  }

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
      return NextResponse.json({ riskScore: 0, explanation: "No file" });
    }

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return NextResponse.json({ riskScore: 0, explanation: "Missing token" });
    }

    const buffer = await file.arrayBuffer();
    const type = file.type;

    // 🔥 MODEL 1
    const model1 = await queryModel(
      "https://router.huggingface.co/hf-inference/models/dima806/deepfake_vs_real_image_detection",
      HF_TOKEN,
      buffer,
      type
    );

    // 🔥 MODEL 2 (different model = better accuracy)
    const model2 = await queryModel(
      "https://router.huggingface.co/hf-inference/models/prithivMLmods/Deep-Fake-Detector-Model",
      HF_TOKEN,
      buffer,
      type
    );

    if (model1.error && model2.error) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "Both models failed"
      });
    }

    const r1 = extractRisk(model1);
    const r2 = extractRisk(model2);

    // 🔥 SMART COMBINATION
    let finalRisk = Math.round((r1 * 0.6) + (r2 * 0.4));

    // bias toward safety (if one is high, increase)
    if (r1 > 70 || r2 > 70) {
      finalRisk = Math.max(r1, r2);
    }

    return NextResponse.json({
      riskScore: finalRisk,
      explanation: `Model A: ${Math.round(r1)}% | Model B: ${Math.round(r2)}%`
    });

  } catch (err: any) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "Server crash: " + err.message
    });
  }
}