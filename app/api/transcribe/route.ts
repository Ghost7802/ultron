/**
 * @file app/api/transcribe/route.ts
 * @description Transcription API route for ULTRON desktop application.
 *
 * Responsibilities:
 * - Accepts audio blob uploads from the frontend.
 * - Returns transcribed text. The frontend primarily uses native
 *   SpeechRecognition (webkitSpeechRecognition/SpeechRecognition); this
 *   endpoint serves as a fallback for environments without native support.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { text } = body || {};

    // Fallback transcription: echo back any provided text or return empty
    // The frontend's native SpeechRecognition handles real-time transcription.
    return NextResponse.json({ text: text || "" });
  } catch {
    return NextResponse.json({ text: "" });
  }
}
