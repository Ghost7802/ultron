/**
 * @file app/api/wakeword/route.ts
 * @description Next.js API route that interfaces with the local OpenWakeWord background listener.
 * 
 * Responsibilities:
 * - GET: Polls for wake-word activation events (e.g. "Ultron") emitted by `ultron_voice_core.py`.
 * - POST: Allows the web interface to enable, disable, or adjust sensitivity on the host microphone wake-word engine.
 */

import { NextResponse } from "next/server";

// Local Voice Core service endpoint
const BACKEND_URL = process.env.STT_BACKEND_URL || "http://127.0.0.1:5001";

/**
 * Polls for wake-word trigger events.
 * 
 * @returns {Promise<NextResponse>} JSON object containing `{ status: string, event: object | null }`.
 */
export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/wakeword/poll`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    return NextResponse.json({ status: "unavailable", event: null });
  } catch {
    return NextResponse.json({ status: "offline", event: null });
  }
}

/**
 * Sends control commands (e.g. start/stop listening, sensitivity updates) to the wake-word engine.
 * 
 * @param {Request} req - HTTP POST request with control payload.
 * @returns {Promise<NextResponse>} JSON response indicating command acknowledgment or error.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${BACKEND_URL}/wakeword/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
    return NextResponse.json({ error: "Failed to control wake-word listener" }, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Backend offline" }, { status: 503 });
  }
}
