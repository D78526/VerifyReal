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

    let finalRisk = 50;

    if (r1 !== null && r2 !== null) {
      finalRisk = (r1 * 0.65) + (r2 * 0.35);
    } else if (r1 !== null) {
      finalRisk = r1;
    } else if (r2 !== null) {
      finalRisk = r2;
    }

    finalRisk = Math.round(Math.min(100, finalRisk));

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

    if (r1 !== null && r2 !== null) {
      const diff = Math.abs(r1 - r2);
      if (diff > 30) {
        reasons.push("Model disagreement detected");
      }
    }

    if (finalRisk > 70) {
      reasons.push("Strong manipulation patterns detected");
    } else if (finalRisk > 50) {
      reasons.push("Minor inconsistencies detected");
    } else {
      reasons.push("No major manipulation signals");
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