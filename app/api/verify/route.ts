import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "No file uploaded"
      });
    }

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "Missing HF_TOKEN"
      });
    }

    // ✅ SEND REAL BINARY (NOT BASE64)
    const buffer = await file.arrayBuffer();

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/dima806/deepfake_vs_real_image_detection",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: buffer,
      }
    );

    // Read raw text first (avoids crash)
    const text = await response.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        riskScore: 0,
        explanation: "HF non-JSON: " + text.slice(0, 120)
      });
    }

    // 🔥 Handle errors from HF
    if (data.error) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "HF error: " + data.error
      });
    }

    let risk = 50;

    // ✅ Correct parsing
    if (Array.isArray(data) && data[0]) {
      const results = data[0];

      // Sometimes returns multiple labels
      const fake = results.find((r: any) =>
        r.label.toLowerCase().includes("fake")
      );

      if (fake) {
        risk = Math.round(fake.score * 100);
      } else {
        // fallback
        risk = 50;
      }
    }

    return NextResponse.json({
      riskScore: risk,
      explanation: `Deepfake probability: ${risk}%`
    });

  } catch (err: any) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "Server crash: " + err.message
    });
  }
}