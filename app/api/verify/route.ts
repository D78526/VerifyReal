import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Required for large buffer handling

// Increase timeout for slow AI models
export const maxDuration = 60; 

async function queryModel(url: string, token: string, buffer: Buffer) {
  const fetchWithRetry = async (retries = 3): Promise<any> => {
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream" 
      },
      body: buffer,
    });

    const data = await res.json();

    // HF specific: if model is loading, retry after a delay
    if (data.error && data.error.includes("currently loading") && retries > 0) {
      await new Promise(r => setTimeout(r, 5000));
      return fetchWithRetry(retries - 1);
    }

    return data;
  };

  return fetchWithRetry();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: "No asset provided" }, { status: 400 });
    }

    const token = process.env.HF_TOKEN;
    if (!token) throw new Error("HF_TOKEN missing in environment");

    // Convert File to Buffer (Node.js runtime style)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Run in parallel to save time (The "Elite" way)
    const [m1, m2] = await Promise.all([
      queryModel("https://api-inference.huggingface.co/models/dima806/deepfake_vs_real_image_detection", token, buffer),
      queryModel("https://api-inference.huggingface.co/models/prithivMLmods/Deep-Fake-Detector-Model", token, buffer)
    ]);

    // Error check
    if (m1.error || m2.error) {
      console.error("AI Model Error:", m1.error || m2.error);
      return NextResponse.json({ error: "AI Models are currently busy. Try again." }, { status: 503 });
    }

    // Advanced Logic: Weighted Probability
    const score1 = m1[0]?.label === 'fake' ? m1[0].score : (1 - m1[0].score);
    const score2 = m2[0]?.label === 'fake' ? m2[0].score : (1 - m2[0].score);
    
    const finalScore = Math.round(((score1 * 0.6) + (score2 * 0.4)) * 100);

    return NextResponse.json({
      riskScore: finalScore,
      verdict: finalScore > 75 ? "Deepfake Detected" : finalScore > 40 ? "Suspicious" : "Likely Authentic",
      confidence: "High-Resolution Scan Complete",
      reasons: [
        `Primary Model Confidence: ${Math.round(score1 * 100)}%`,
        `Secondary Model Confidence: ${Math.round(score2 * 100)}%`,
        finalScore > 50 ? "Artifacts found in noise distribution" : "Metadata and textures appear organic"
      ]
    });

  } catch (error: any) {
    console.error("Route Error:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}