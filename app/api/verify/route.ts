import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "Missing Hugging Face token"
      });
    }

    const res = await fetch(
      "https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": file.type || "application/octet-stream"
        },
        body: await file.arrayBuffer(),
      }
    );

    const data = await res.json();

    let risk = 50;

    if (Array.isArray(data) && data[0]) {
      const item = data[0];

      if (item.label?.toLowerCase().includes("fake")) {
        risk = Math.round(item.score * 100);
      } else {
        risk = Math.round((1 - item.score) * 100);
      }
    }

    return NextResponse.json({
      riskScore: risk,
      explanation: `Model result: ${risk}% deepfake probability`
    });

  } catch (err) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "Server error"
    });
  }
}