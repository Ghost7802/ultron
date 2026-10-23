/**
 * @file app/api/transcribe/route.ts
 * @description Next.js API route that proxies microphone audio to the local Faster-Whisper STT server.
 * 
 * Architecture & Data Flow:
 * 1. JarvisOrb records audio in the browser (WAV/WebM binary stream).
 * 2. JarvisOrb sends a POST request with the raw audio binary to this endpoint (`/api/transcribe`).
 * 3. This route enforces payload safety checks (max 25MB, non-empty validation).
 * 4. The audio is forwarded to the local Python STT server running on `http://127.0.0.1:5001/transcribe`.
 * 5. Returns `{ text: "transcribed speech" }` to the frontend.
 */

import { NextResponse } from "next/server";

// Local Faster-Whisper Speech-to-Text server address
const STT_URL = process.env.STT_URL || "http://127.0.0.1:5001/transcribe";

// Maximum acceptable audio payload (25 MB) to avoid memory exhaustion
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * Handles incoming audio transcription requests.
 * 
 * @param {Request} req - The incoming HTTP POST request containing raw audio binary.
 * @returns {Promise<NextResponse>} JSON response containing the transcribed text string or an error.
 */
export async function POST(req: Request) {
  // Validate request header size before reading body into memory
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Audio recording is too large. Keep each recording under 25 MB." },
      { status: 413 },
    );
  }

  try {
    const audioBuffer = await req.arrayBuffer();

    // Reject empty audio clips to avoid unnecessary downstream model execution
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
      // Forward raw audio to the local Faster-Whisper Python microservice with a 15-second timeout
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
      // If the local Python STT server is still spinning up or temporarily busy, log warning and gracefully degrade
      console.warn("[Transcribe API] STT server request failed or timed out:", sttErr);
    }

    // Graceful fallback: return empty transcription without crashing the client HUD
    return NextResponse.json({ text: "" });
  } catch (error) {
    console.error("Transcribe API error:", error);
    return NextResponse.json({ text: "" });
  }
}
