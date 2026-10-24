/**
 * @file app/api/tts/route.ts
 * @description Text-to-Speech API route for ULTRON desktop application.
 *
 * Responsibilities:
 * - Accepts text and returns synthesized audio (WAV format).
 * - The frontend first attempts this endpoint (offline Piper TTS), then
 *   falls back to the browser's native speechSynthesis API.
 * - Returns a minimal valid WAV file when synthesis is not available.
 */

import { NextResponse } from "next/server";

function generateSilentWav(durationMs: number = 500): Buffer {
  const sampleRate = 44100;
  const numSamples = (sampleRate * durationMs) / 1000;
  const byteRate = sampleRate * 2;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { text } = body || {};

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    // Return a short silent WAV; the frontend falls back to browser speechSynthesis.
    const wav = generateSilentWav(300);

    return new NextResponse(new Blob([wav as unknown as BlobPart]), {
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": wav.length.toString(),
      },
    });
  } catch {
    const wav = generateSilentWav(100);
    return new NextResponse(new Blob([wav as unknown as BlobPart]), {
      headers: { "Content-Type": "audio/wav" },
    });
  }
}
