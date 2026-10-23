/**
 * @file app/api/tts/route.ts
 * @description Next.js API route that proxies speech synthesis requests to the local Piper neural TTS backend.
 * 
 * Architecture & Data Flow:
 * 1. The frontend (`UltronOrb`) receives a text response from the assistant.
 * 2. It sends a POST request with `{ text: "..." }` to `/api/tts`.
 * 3. This route validates the text and proxies the request to the local Python voice microservice
 *    running Piper ONNX (`http://127.0.0.1:5001/tts/synthesize`).
 * 4. The raw WAV audio stream is returned directly with appropriate audio headers for sub-second playback.
 * 5. DELETE requests trigger instant audio cancellation (`/tts/stop`) for barge-in interruption.
 */

import { NextResponse } from "next/server";

// Local Piper TTS Python backend address
const BACKEND_URL = process.env.STT_BACKEND_URL || "http://127.0.0.1:5001";

/**
 * Handles speech synthesis requests.
 * 
 * @param {Request} req - HTTP POST request containing `{ text: string }` JSON body.
 * @returns {Promise<Response>} Streamed or buffered WAV audio binary (audio/wav), or JSON error.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = (body.text || "").trim();
    if (!text) {
      return NextResponse.json({ error: "text parameter is required" }, { status: 400 });
    }

    // Forward synthesis request to the Python Piper TTS engine with a 10s timeout
    const res = await fetch(`${BACKEND_URL}/tts/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Backend TTS returned ${res.status}` }, { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    // If offline TTS engine is unavailable, return 503 so frontend can fall back to browser Web Speech API
    return NextResponse.json({ error: err.message || "Offline TTS unavailable" }, { status: 503 });
  }
}

/**
 * Handles barge-in cancellation requests.
 * When the user begins speaking while ULTRON is talking, the frontend triggers DELETE /api/tts
 * to immediately silence ongoing audio output on the host.
 * 
 * @returns {Promise<NextResponse>} JSON response indicating status.
 */
export async function DELETE() {
  try {
    const res = await fetch(`${BACKEND_URL}/tts/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      return NextResponse.json({ status: "stopped" });
    }
  } catch {}
  return NextResponse.json({ status: "ok" });
}
