/**
 * @file app/api/wakeword/route.ts
 * @description Wake word API route for ULTRON desktop application.
 *
 * Responsibilities:
 * - Polling endpoint for hands-free wake word detection.
 * - Returns a WAKE_WORD_DETECTED event when triggered.
 * - Currently returns idle; the frontend can enable wake word via system hotkey.
 */

import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  // Wake word detection is handled via keyboard shortcut (V key) in the desktop app.
  // This endpoint remains available for future integration with always-listening hardware.
  return NextResponse.json({ event: null, status: "idle" });
}
