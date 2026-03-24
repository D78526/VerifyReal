import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const formData = await req.formData();
  const files = Array.from(formData.values()) as File[];

  const HF_TOKEN = process.env.HF_TOKEN;

  const models = [
    'dima806/deepfake_vs_real_image_detection',
    'prithivMLmods/Deepfake-Detect-Siglip2',
    'onnx-community/Deep-Fake-Detector-v2-Model-ONNX'
  ];

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
          risk = item.label?.toLowerCase().includes('fake')
            ? Math.round(item.score * 100)
            : Math.round((1 - item.score) * 100);
        }

        modelTotal += risk;
      } catch {
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
    explanation: `Multi-frame ensemble: ${finalRisk}% • ${details.join(' | ')}`
  });
}