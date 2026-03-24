import { NextResponse } from 'next/server';

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
        explanation: "Missing HF token"
      });
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const response = await fetch(
      "https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: base64
        }),
      }
    );

    const data = await response.json();

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
      explanation: `AI result: ${risk}% deepfake probability`
    });

  } catch (err: any) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "Server crash: " + err.message
    });
  }
}