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

    const text = await response.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        riskScore: 0,
        explanation: "HF non-JSON: " + text.slice(0, 100)
      });
    }

    if (data.error) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "HF error: " + data.error
      });
    }

    let risk = 50;

    // 🔥 HANDLE ALL POSSIBLE FORMATS
    if (Array.isArray(data)) {
      let results = data;

      // case: [[...]]
      if (Array.isArray(data[0])) {
        results = data[0];
      }

      if (results.length > 0) {
        const fake = results.find((r: any) =>
          r.label?.toLowerCase().includes("fake")
        );

        if (fake) {
          risk = Math.round(fake.score * 100);
        } else {
          // fallback: use highest score
          const top = results.reduce((a: any, b: any) =>
            a.score > b.score ? a : b
          );
          risk = Math.round((1 - top.score) * 100);
        }
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