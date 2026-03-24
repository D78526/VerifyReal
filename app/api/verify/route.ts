import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "No file received"
      });
    }

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "Missing HF_TOKEN in Vercel"
      });
    }

    const buffer = await file.arrayBuffer();

    const response = await fetch(
      "https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": file.type || "application/octet-stream"
        },
        body: buffer,
      }
    );

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({
        riskScore: 0,
        explanation: "HF returned non-JSON: " + text.slice(0, 100)
      });
    }

    let risk = 50;

    if (Array.isArray(data) && data[0]) {
      const item = data[0];

      if (item.label?.toLowerCase().includes("fake")) {
        risk = Math.round(item.score * 100);
      } else {
        risk = Math.round((1 - item.score) * 100);
      }
    } else if (data.error) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "HF error: " + data.error
      });
    }

    return NextResponse.json({
      riskScore: risk,
      explanation: `Result: ${risk}%`
    });

  } catch (err: any) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "SERVER CRASH: " + err.message
    });
  }
}