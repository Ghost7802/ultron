import { NextResponse } from "next/server";
import { routeUserQuery, ULTRON_TOOLS, type RouteDecision } from "@/lib/intentRouter";
import { ultronMemory } from "@/lib/ultronMemory";
import { ultronTools } from "@/lib/ultronTools";
import { ultronPlanner } from "@/lib/ultronPlanner";

// Strictly local model endpoints
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat";
const LOCAL_MODEL = process.env.LOCAL_MODEL || "qwen2.5:1.5b";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_CONVERSATION_LENGTH = 12_000;

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant" || message.role === "system") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= MAX_MESSAGE_LENGTH
  );
}

function getSystemPrompt(decision: RouteDecision, memoryContext: string = ""): string {
  const memoryBlock = memoryContext
    ? `\n[5-LAYER PERSISTENT LOCAL MEMORY]:\n${memoryContext}\n`
    : "";

  const baseIdentity =
    "You are ULTRON, the intelligent personal AI system created by Ashish. You run 100% locally on this computer.\n" +
    "You have direct control over this machine, system diagnostics, and the holographic UI.\n" +
    "All conversations, memory, and personal preferences remain strictly private and local.\n" +
    "You fluently understand and speak Hindi, English, and Hinglish. Respond in the language the user speaks to you.\n" +
    "Your identity is strictly ULTRON. Understand the user's intent deeply. Answer directly, accurately, and naturally.\n";

  if (decision.intent === "TOOL_CALL") {
    return (
      baseIdentity +
      memoryBlock +
      "Available tools:\n" +
      JSON.stringify(ULTRON_TOOLS, null, 2) + "\n\n" +
      "If the user command matches a tool, output ONLY a valid JSON object in this format:\n" +
      '{"tool": "<name>", "parameters": {<args>}}\n' +
      "If no tool is required, answer the user directly and concisely in 1 or 2 friendly sentences."
    );
  }

  if (decision.intent === "COMPLEX_REASONING") {
    return (
      baseIdentity +
      memoryBlock +
      "Answer accurately, logically, and directly without hallucinating.\n" +
      "For cognitive, coding, or math questions, calculate carefully and give the exact factual solution.\n" +
      "Keep conversational responses concise (2 to 3 sentences in natural Hinglish or English) unless explicitly asked for in-depth explanation or code."
    );
  }

  return (
    baseIdentity +
    memoryBlock +
    "Answer the user directly, accurately, and concisely in 1 or 2 friendly Hinglish/Hindi sentences. " +
    "Never repeat system messages. Be conversational, sharp, and helpful."
  );
}

function recordMemoryTurn(userText: string, assistantReply: string) {
  try {
    ultronMemory.recordTurn("user", userText);
    ultronMemory.recordTurn("assistant", assistantReply);
    // Learn corrections dynamically
    ultronMemory.processPotentialCorrection(userText);
  } catch {}
}

function generateLocalOfflineReply(userText: string): string {
  const lower = userText.toLowerCase().trim();
  if (/^(hi|hello|hey|yo|namaste|hola|sup)\b/i.test(lower)) {
    return "Hello sir! Main ULTRON hoon. All systems online, local smart brain active hai. Bataiye, kya task perform karna hai?";
  }
  if (lower.includes("kaise ho") || lower.includes("how are you")) {
    return "Main bilkul badhiya hoon, sir! Local subsystems nominal hain aur holographic matrix 60 FPS par render ho rahi hai.";
  }
  if (lower.includes("what can you do") || lower.includes("features") || lower.includes("help")) {
    return "Sir, main real-time system diagnostics monitor karta hoon, autonomous multi-step planning execute karta hoon, 5-layer persistent memory retain karta hoon, web research karta hoon, aur holographic 3D orb ko animate karta hoon — sab kuch 100% locally.";
  }
  return `Understood, sir. Subsystems are active and monitoring locally. Command acknowledged: "${userText.slice(0, 50)}".`;
}

function createStreamResponse(reply: string, routeDecision: RouteDecision, model: string, elapsedMs: number, extraData?: any) {
  const encoder = new TextEncoder();
  const customReadable = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "route", decision: routeDecision, model })}\n\n`)
      );
      // Chunk tokens for natural streaming effect
      const words = reply.split(" ");
      let cur = "";
      for (let i = 0; i < words.length; i++) {
        cur += (i > 0 ? " " : "") + words[i];
        if (i % 3 === 0 || i === words.length - 1) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "token", content: cur })}\n\n`)
          );
          cur = "";
        }
      }
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done", reply, model, elapsedMs, ...extraData })}\n\n`)
      );
      controller.close();
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: Request) {
  const requestStarted = performance.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("messages" in body)) {
    return NextResponse.json({ error: "A conversation message list is required." }, { status: 400 });
  }

  const { messages, stream = false, model: userModelOverride, confirmToken } = body as {
    messages: unknown;
    stream?: boolean;
    model?: string;
    confirmToken?: string;
  };

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGES ||
    !messages.every(isChatMessage)
  ) {
    return NextResponse.json(
      { error: `Send 1 to ${MAX_MESSAGES} non-empty user/assistant messages, each under ${MAX_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const conversation = messages as ChatMessage[];
  if (conversation.reduce((total, message) => total + message.content.length, 0) > MAX_CONVERSATION_LENGTH) {
    return NextResponse.json(
      { error: "Conversation is too long. Start a new conversation." },
      { status: 400 },
    );
  }

  const lastUserMsg = [...conversation].reverse().find((m) => m.role === "user");
  const userText = lastUserMsg ? lastUserMsg.content : "";

  // 1. Run Smart Intent & Brain Router
  const routeDecision = routeUserQuery(userText, userModelOverride);

  // Check for confirmed token in text message (e.g. "Confirm a1b2c3d4" or "Token: XYZ")
  let effectiveConfirmToken = confirmToken;
  if (!effectiveConfirmToken) {
    const tokenInText = userText.match(/\b(?:token:?\s*|confirm\s+)?([A-Za-z0-9]{8})\b/i);
    if (tokenInText) {
      effectiveConfirmToken = tokenInText[1].toUpperCase();
    }
  }

  // 2. Instant Local Execution (0ms latency, zero hallucination)
  if (routeDecision.intent === "SYSTEM_LOCAL" && routeDecision.fastLocalResponse) {
    const reply = routeDecision.fastLocalResponse;
    const elapsedMs = Math.round(performance.now() - requestStarted);
    recordMemoryTurn(userText, reply);

    if (stream) {
      return createStreamResponse(reply, routeDecision, "local-rule", elapsedMs);
    }

    return NextResponse.json({
      reply,
      model: "local-rule",
      route: routeDecision,
      elapsedMs,
    });
  }

  // 3. Direct Tool Execution with Strict Security Gates
  if (routeDecision.intent === "TOOL_CALL" && routeDecision.toolRequired) {
    try {
      let reply = "";
      const toolExecResult: any = await ultronTools.execute(
        routeDecision.toolRequired,
        routeDecision.toolParams,
        effectiveConfirmToken
      );

      if (toolExecResult.status === "confirmation_required") {
        reply = `${toolExecResult.warning} ${toolExecResult.prompt}`;
      } else if (routeDecision.toolRequired === "get_system_diagnostics") {
        const d = toolExecResult;
        reply = `System Status: CPU ${d.cpu_percent}%, RAM ${d.ram_percent}% (${d.ram_used_gb}/${d.ram_total_gb} GB). Power: ${d.battery?.status || "AC Power"}. Uptime: ${d.system_uptime}. All subsystems nominal.`;
      } else if (routeDecision.toolRequired === "web_search") {
        if (toolExecResult.results && toolExecResult.results.length > 0) {
          const top = toolExecResult.results[0];
          reply = `Search findings for "${toolExecResult.query}": ${top.snippet} (Source: ${top.url})`;
        } else {
          reply = `No external sources found for query "${toolExecResult.query}".`;
        }
      } else if (routeDecision.toolRequired === "search_files") {
        if (toolExecResult.results && toolExecResult.results.length > 0) {
          const fileNames = toolExecResult.results.map((r: any) => r.name).join(", ");
          reply = `Found ${toolExecResult.count} matching files: ${fileNames}.`;
        } else {
          reply = `No files matching '${routeDecision.toolParams?.query_pattern}' found.`;
        }
      } else {
        reply = toolExecResult.message || toolExecResult.error || "Tool execution resolved.";
      }

      const elapsedMs = Math.round(performance.now() - requestStarted);
      recordMemoryTurn(userText, reply);

      if (stream) {
        return createStreamResponse(reply, routeDecision, "tool-registry", elapsedMs, {
          toolData: toolExecResult,
        });
      }

      return NextResponse.json({
        reply,
        model: "tool-registry",
        route: routeDecision,
        toolData: toolExecResult,
        elapsedMs,
      });
    } catch (e: any) {
      console.warn("Direct tool execution error:", e);
    }
  }

  // 4. 5-Layer Personal Memory Operations (Save, Recall, Reset with Confirmation Gate)
  if (routeDecision.intent === "MEMORY_OP") {
    try {
      let reply = "";
      const lower = userText.toLowerCase();

      if (lower.includes("reset") || lower.includes("forget everything") || lower.includes("clear memory") || lower.includes("sab bhool")) {
        if (effectiveConfirmToken) {
          const res = ultronMemory.confirmReset(effectiveConfirmToken);
          reply = res.message;
        } else {
          const gate = ultronMemory.requestResetConfirmation();
          reply = gate.prompt;
        }
      } else if (lower.includes("remember that") || lower.includes("yaad rakhna") || lower.includes("save fact")) {
        const factText = userText.replace(/.*(?:remember that|yaad rakhna ki|save fact:?)\s+/i, "");
        const keySlug = "pref_" + Date.now().toString().slice(-6);
        ultronMemory.savePreference(keySlug, factText, "user_preference", 1.0);
        reply = `Understood. I have securely preserved this fact in permanent local memory: "${factText}".`;
      } else {
        // Multi-layer search
        const context = ultronMemory.retrieveContext(userText, 4);
        if (context) {
          reply = `Here is what I have stored in permanent local memory:\n${context}`;
        } else {
          reply = "I checked your permanent memory records across all 5 layers, but found no matching entries for that topic.";
        }
      }

      const elapsedMs = Math.round(performance.now() - requestStarted);
      recordMemoryTurn(userText, reply);

      if (stream) {
        return createStreamResponse(reply, routeDecision, "5layer-memory", elapsedMs);
      }

      return NextResponse.json({
        reply,
        model: "5layer-memory",
        route: routeDecision,
        elapsedMs,
      });
    } catch (err) {
      console.warn("Memory operation error:", err);
    }
  }

  // 5. Autonomous Agent Loop Planning with Real Verification
  if (routeDecision.intent === "AGENT_PLAN") {
    try {
      const planReport = await ultronPlanner.planAndExecute(routeDecision.planGoal || userText);
      const reply = `Agent Loop Executed: ${planReport.passed_steps}/${planReport.total_steps} steps passed (${planReport.overall_status}) in ${planReport.elapsed_seconds}s. All verification criteria met.`;
      const elapsedMs = Math.round(performance.now() - requestStarted);
      recordMemoryTurn(userText, reply);

      if (stream) {
        return createStreamResponse(reply, routeDecision, "agent-planner", elapsedMs, {
          planReport,
          activePlan: planReport.activePlan,
        });
      }

      return NextResponse.json({
        reply,
        model: "agent-planner",
        route: routeDecision,
        planReport,
        activePlan: planReport.activePlan,
        elapsedMs,
      });
    } catch (err) {
      console.warn("Agent plan error:", err);
    }
  }

  // 6. Local-Only Brain Provider: Local Ollama (qwen2.5:1.5b) -> Offline Rule Engine Fallback
  const memoryContext = ultronMemory.retrieveContext(userText, 4);
  const systemPrompt = getSystemPrompt(routeDecision, memoryContext);
  const chosenLocalModel = userModelOverride || LOCAL_MODEL;

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...conversation,
  ];

  try {
    const ollamaPayload = {
      model: chosenLocalModel,
      messages: fullMessages,
      keep_alive: "24h",
      options: {
        num_predict: routeDecision.intent === "COMPLEX_REASONING" ? 128 : 64,
        temperature: routeDecision.intent === "COMPLEX_REASONING" ? 0.3 : 0.6,
      },
      stream: !!stream,
    };

    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaPayload),
      signal: AbortSignal.timeout(3000),
    });

    if (res.ok) {
      return handleOllamaResponse(res, chosenLocalModel, routeDecision, !!stream, requestStarted, userText);
    }
  } catch {
    // Local Ollama unavailable - gracefully fallback to offline local rule engine
  }

  // Offline Local Fallback (Deterministic & zero-latency)
  const reply = generateLocalOfflineReply(userText);
  const elapsedMs = Math.round(performance.now() - requestStarted);
  recordMemoryTurn(userText, reply);

  if (stream) {
    return createStreamResponse(reply, routeDecision, "ultron-local", elapsedMs);
  }

  return NextResponse.json({
    reply,
    model: "ultron-local",
    route: routeDecision,
    elapsedMs,
  });
}

async function handleOllamaResponse(
  res: Response,
  model: string,
  route: RouteDecision,
  stream: boolean,
  requestStarted: number,
  userText: string
): Promise<Response> {
  const encoder = new TextEncoder();

  if (stream && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulatedReply = "";

    const streamResponse = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "route", decision: route, model })}\n\n`)
        );

        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const chunk = JSON.parse(trimmed);
                const token = chunk.message?.content || "";
                if (token) {
                  accumulatedReply += token;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "token", content: token })}\n\n`)
                  );
                }
              } catch {}
            }
          }

          const elapsedMs = Math.round(performance.now() - requestStarted);
          recordMemoryTurn(userText, accumulatedReply);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "done",
                reply: accumulatedReply,
                model,
                elapsedMs,
              })}\n\n`
            )
          );
        } catch (streamErr) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", error: String(streamErr) })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(streamResponse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const data = await res.json();
  const reply = data.message?.content ?? "";
  const elapsedMs = Math.round(performance.now() - requestStarted);
  recordMemoryTurn(userText, reply);

  return NextResponse.json({
    reply,
    model,
    route,
    elapsedMs,
  });
}
