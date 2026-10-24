/**
 * @file app/api/chat/route.ts
 * @description Chat API route for ULTRON desktop application.
 *
 * Responsibilities:
 * - Accepts chat messages from the frontend UltronOrb component.
 * - Generates assistant responses using a local rule-based + pattern matching engine.
 * - Supports SSE streaming for real-time token delivery.
 * - Falls back gracefully when no external LLM API is configured.
 */

import { NextRequest, NextResponse } from "next/server";

const KNOWN_RESPONSES: Record<string, string> = {
  "hello": "Hello. ULTRON systems online. How can I assist you today?",
  "hi": "Hello. ULTRON systems online. How can I assist you today?",
  "hey": "Hello. ULTRON systems online. How can I assist you today?",
  "what is your name": "I am ULTRON, your desktop AI assistant.",
  "who are you": "I am ULTRON, an AI assistant running locally on your desktop.",
  "what can you do": "I can chat with you, process voice commands, recognize hand gestures via your camera, and help with desktop tasks. Say or type something to get started.",
  "help": "You can type or speak to me. Press V for voice chat, T for text input, G for hand gestures, and R to reset the 3D view.",
  "status": "ULTRON desktop application is running. All local systems operational.",
  "goodbye": "Goodbye. ULTRON standing by.",
  "bye": "Goodbye. ULTRON standing by.",
};

function generateResponse(message: string): string {
  const lower = message.toLowerCase().trim();

  for (const [key, response] of Object.entries(KNOWN_RESPONSES)) {
    if (lower.includes(key)) {
      return response;
    }
  }

  if (lower.includes("time")) {
    return `The current time is ${new Date().toLocaleTimeString()}.`;
  }

  if (lower.includes("date")) {
    return `Today is ${new Date().toLocaleDateString()}.`;
  }

  if (lower.includes("desktop") || lower.includes("system")) {
    return "ULTRON is running as a standalone desktop application on your system. Camera and microphone access are available through system permissions.";
  }

  if (lower.includes("camera") || lower.includes("gesture")) {
    return "Camera and hand gesture tracking are available. Press G in the ULTRON interface to enable gesture controls.";
  }

  if (lower.includes("microphone") || lower.includes("voice") || lower.includes("mic")) {
    return "Microphone and voice chat are available. Press V in the ULTRON interface to start voice conversation.";
  }

  return `I received your message: "${message}". I'm running locally on your desktop. Try asking me about the time, date, or what I can do.`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { messages, stream = false } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const userText = lastMessage?.content || "";
    const reply = generateResponse(userText);

    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const words = reply.split(" ");
          for (let i = 0; i < words.length; i++) {
            const chunk = JSON.stringify({ type: "token", content: words[i] + (i < words.length - 1 ? " " : "") });
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", reply })}\n\n`));
          controller.close();
        },
      });

      return new NextResponse(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
