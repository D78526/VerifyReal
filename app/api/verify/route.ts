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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ riskScore: 0, explanation: "No file uploaded" });
    }

    const token = process.env.HF_TOKEN;
    if (!token) {
      return NextResponse.json({ riskScore: 0, explanation: "Server not configured" });
    }

    const buffer = await file.arrayBuffer();
    const type = file.type;

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

    let finalRisk = Math.round((r1 * 0.6) + (r2 * 0.4));

    if (r1 > 70 || r2 > 70) {
      finalRisk = Math.max(r1, r2);
    }

    // ✅ HUMAN-FRIENDLY RESULT
    let message = "";
    let confidence = "";

    if (finalRisk > 75) {
      message = "High likelihood of manipulation";
      confidence = "High confidence";
    } else if (finalRisk > 55) {
      message = "Possible manipulation detected";
      confidence = "Medium confidence";
    } else if (finalRisk > 35) {
      message = "Uncertain result";
      confidence = "Low confidence";
    } else {
      message = "Likely authentic content";
      confidence = "High confidence";
    }

    return NextResponse.json({
      riskScore: finalRisk,
      explanation: `${message} • ${confidence}`
    });

  } catch (err: any) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "System error"
    });
  }
}