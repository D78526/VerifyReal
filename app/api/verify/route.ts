import { NextResponse } from 'next/server';

const HF_TOKEN = process.env.HF_TOKEN!;
const MODEL = "umm-maybe/AI-image-detector"; // you can swap later

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();

    // 🔥 send RAW binary (no base64)
    const res = await fetch(
      `https://router.huggingface.co/hf-inference/models/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/octet-stream",
        },
        body: bytes,
      }
    );

    const text = await res.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({
        error: "HF returned non-JSON",
        raw: text.slice(0, 200),
      });
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid HF response", parsed });
    }

    const scores = parsed.map((p: any) => p.score || 0);

    const max = Math.max(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    let riskScore = (max * 0.7 + avg * 0.3) * 100;

    // 🔥 variance boost (detect "too perfect")
    const variance =
      scores.reduce((a, s) => a + Math.pow(s - avg, 2), 0) / scores.length;

    if (variance < 0.01 && avg < 0.3) {
      riskScore += 20;
    }

    // 🔥 boost weak detections
    if (riskScore < 20) riskScore *= 2.5;
    if (riskScore < 40) riskScore *= 1.5;

    riskScore = Math.min(100, Math.round(riskScore));

    let verdict = "Likely Real";
    if (riskScore > 75) verdict = "High Risk AI";
    else if (riskScore > 50) verdict = "Possible AI";
    else if (riskScore > 25) verdict = "Suspicious";

    return NextResponse.json({
      riskScore,
      verdict,
      details: [
        `Peak anomaly: ${Math.round(max * 100)}%`,
        `Average signal: ${Math.round(avg * 100)}%`,
        `Consistency: ${Math.round((1 - variance) * 100)}%`,
      ],
    });
  } catch (err: any) {
    return NextResponse.json({
      error: "Server crash",
      message: err.message,
    });
  }
}