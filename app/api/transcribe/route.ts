import { NextResponse } from "next/server";

const STT_URL = process.env.STT_URL || "http://127.0.0.1:5001/transcribe";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio recording is too large. Keep each recording under 25 MB." },
      { status: 413 },
    );
  }

  try {
    const audioBuffer = await req.arrayBuffer();
    if (audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Audio recording is empty." }, { status: 400 });
    }
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio recording is too large. Keep each recording under 25 MB." },
        { status: 413 },
      );
    }

    const contentType = req.headers.get("content-type") || "application/octet-stream";
    try {
      const sttRes = await fetch(STT_URL, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: audioBuffer,
        signal: AbortSignal.timeout(15000),
      });

      if (sttRes.ok) {
        const data: { text?: unknown; error?: unknown } = await sttRes.json();
        if (typeof data.text === "string") {
          return NextResponse.json({ text: data.text });
        }
      }
    } catch (sttErr) {
      console.warn("[Transcribe API] STT server request failed or timed out:", sttErr);
    }

    return NextResponse.json({ text: "" });
  } catch (error) {
    console.error("Transcribe API error:", error);
    return NextResponse.json({ text: "" });
  }
}
