import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = Array.from(formData.values()) as File[];

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return NextResponse.json({
        riskScore: 0,
        explanation: "ERROR: Missing Hugging Face token"
      });
    }

    const models = [
      'dima806/deepfake_vs_real_image_detection',
      'prithivMLmods/Deepfake-Detect-Siglip2'
    ]; // removed broken ONNX model

    let totalRisk = 0;
    const details: string[] = [];

    for (const model of models) {
      let modelTotal = 0;

      for (const file of files) {
        try {
          const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${HF_TOKEN}`,
              'Content-Type': file.type || 'application/octet-stream'
            },
            body: await file.arrayBuffer(),
          });

          const data = await res.json();

          let risk = 50;

          if (Array.isArray(data) && data[0]) {
            const item = data[0];

            if (item.label?.toLowerCase().includes('fake')) {
              risk = Math.round(item.score * 100);
            } else {
              risk = Math.round((1 - item.score) * 100);
            }
          } else {
            console.log("Bad response:", data);
          }

          modelTotal += risk;
        } catch (err) {
          console.log("Model error:", err);
          modelTotal += 50;
        }
      }

      const avgModelRisk = Math.round(modelTotal / files.length);
      totalRisk += avgModelRisk;
      details.push(`${model.split('/')[1]}: ${avgModelRisk}%`);
    }

    const finalRisk = Math.round(totalRisk / models.length);

    return NextResponse.json({
      riskScore: finalRisk,
      explanation: `Result: ${finalRisk}% • ${details.join(' | ')}`
    });

  } catch (err) {
    return NextResponse.json({
      riskScore: 0,
      explanation: "SERVER ERROR"
    });
  }
}