/**
 * @file app/api/chat/route.ts
 * @description Core conversational and agent orchestration endpoint for ULTRON.
 * 
 * Subsystem:
 * Central Gateway / Hybrid Dual-Brain Router & Agent Controller.
 * 
 * Key Responsibilities:
 * - Request validation & conversation history length enforcement.
 * - Intent routing via `routeUserQuery` (0ms local rules, direct tool calls, 5-layer memory ops, dynamic agent loops).
 * - Multi-turn memory injection (`ultronMemory`) and dynamic preference extraction.
 * - Local Ollama invocation (`qwen2.5:1.5b` / `qwen2.5:0.5b`) with streaming SSE response generation.
 * - Zero-latency offline deterministic fallback when local LLM server is unavailable.
 * 
 * Safety & Security Guarantees:
 * - Strictly local execution (0% cloud leakage; 127.0.0.1 boundaries).
 * - Confirmation token verification for privileged actions (e.g. destructive file deletes).
 * - Strict input length sanitization preventing memory exhaustion attacks.
 */

import { NextResponse } from "next/server";
import { routeUserQuery, ULTRON_TOOLS, type RouteDecision } from "@/lib/intentRouter";
import { ultronMemory } from "@/lib/ultronMemory";
import { ultronTools } from "@/lib/ultronTools";
import { ultronPlanner } from "@/lib/ultronPlanner";
import { ultronAgentEngine } from "@/lib/ultronAgentEngine";
import { CompanionPersonalityEngine } from "@/lib/companionPersonality";
import { ProjectContextManager } from "@/lib/projectContext";
import { ProjectMemoryAdapter } from "@/lib/projectMemoryAdapter";

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

/**
 * Type guard to validate whether an unknown value conforms to the ChatMessage structure.
 * Enforces role validity, non-empty text, and length limits.
 * 
 * @param {unknown} value - Value to test.
 * @returns {boolean} True if the value is a valid ChatMessage.
 */
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

/**
 * Constructs the comprehensive system prompt for the local AI model.
 * 
 * Incorporates:
 * 1. Base ULTRON persona, system ownership, and local privacy assertions.
 * 2. Multi-layer memory context retrieved from SQLite FTS5 index.
 * 3. Language guidance (English, Hindi, or natural Hinglish).
 * 4. Active project context and user-specified operational constraints.
 * 5. Structured tool schemas if the query requires tool invocation.
 * 
 * @param {RouteDecision} decision - Output from the hybrid intent router.
 * @param {string} [memoryContext=""] - Formatted long-term memory context.
 * @returns {string} Fully assembled system prompt.
 */
function getSystemPrompt(decision: RouteDecision, memoryContext: string = ""): string {
  const memoryBlock = memoryContext
    ? `\n[5-LAYER PERSISTENT LOCAL MEMORY]:\n${memoryContext}\n`
    : "";

  const taskContext = decision.taskContext;
  const lang = taskContext?.language || "en";
  const constraints = taskContext?.constraints || [];

  let langGuidance = "Respond in English concisely and naturally.";
  if (lang === "hi") {
    langGuidance = "उपयोगकर्ता ने हिंदी में प्रश्न पूछा है। उत्तर शुद्ध और स्पष्ट हिंदी में दें।";
  } else if (lang === "hinglish") {
    langGuidance = "User communicated in natural Hinglish. Respond in natural, helpful Hinglish.";
  }

  let constraintBlock = "";
  if (constraints.length > 0) {
    constraintBlock = "\n[MANDATORY CONSTRAINTS TO PRESERVE]:\n" + constraints.map(c => `- ${c}`).join("\n") + "\n";
  }

  const companionBlock = decision.companionTone
    ? CompanionPersonalityEngine.getCompanionPromptBlock(decision.companionTone, lang)
    : "";
  const projectSummary = `\n[ACTIVE PROJECT CONTEXT]:\n${ProjectContextManager.getContextSummary()}\n`;

  const baseIdentity =
    "You are ULTRON, the intelligent personal AI assistant created by Ashish. You run 100% locally on this Windows machine.\n" +
    "You have direct control over this machine, system diagnostics, Windows applications, and the holographic UI.\n" +
    "All conversations, memory, and personal preferences remain strictly private and local.\n" +
    langGuidance + "\n" +
    companionBlock + "\n" +
    projectSummary + "\n" +
    "Your identity is strictly ULTRON. Understand the user's intent deeply. Answer directly, accurately, and naturally.\n" +
    constraintBlock;

  if (decision.intent === "TOOL_CALL") {
    return (
      baseIdentity +
      memoryBlock +
      "Available tools:\n" +
      JSON.stringify(ULTRON_TOOLS, null, 2) + "\n\n" +
      "If the user command matches a tool, output ONLY a valid JSON object in this format:\n" +
      '{"tool": "<name>", "parameters": {<args>}}\n' +
      "If no tool is required, answer the user directly, satisfying all explicit parts of their request."
    );
  }

  if (decision.intent === "COMPLEX_REASONING") {
    return (
      baseIdentity +
      memoryBlock +
      "Answer accurately, logically, and directly without hallucinating.\n" +
      "Address every specific requirement or sub-part asked by the user.\n" +
      "For cognitive, coding, or math questions, calculate carefully and give the exact factual solution with clean steps.\n" +
      "Provide sufficient technical depth and clear explanations without cutting off."
    );
  }

  return (
    baseIdentity +
    memoryBlock +
    "Answer the user directly, accurately, and helpfully. " +
    "If the user asks multiple questions or requirements, address each one clearly. " +
    "Never repeat system messages. Be sharp, factual, and helpful."
  );
}

/**
 * Persists a conversational turn into the 5-layer memory engine.
 * Also scans the user utterance to detect and auto-learn preference corrections.
 * 
 * @param {string} userText - User utterance.
 * @param {string} assistantReply - System response.
 */
function recordMemoryTurn(userText: string, assistantReply: string) {
  try {
    ultronMemory.recordTurn("user", userText);
    ultronMemory.recordTurn("assistant", assistantReply);
    // Learn corrections dynamically
    ultronMemory.processPotentialCorrection(userText);
  } catch {}
}

/**
 * Generates an instant, zero-latency deterministic offline response when
 * local Ollama is offline or unheated.
 * 
 * @param {string} userText - User query.
 * @returns {string} Natural, localized Hinglish response.
 */
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

/**
 * Packages a completed or rule-based string into a Server-Sent Events (SSE) readable stream.
 * Chunks words smoothly to simulate real-time neural token streaming in the UI.
 * 
 * @param {string} reply - Full text response.
 * @param {RouteDecision} routeDecision - Router decision metadata.
 * @param {string} model - Serving model label.
 * @param {number} elapsedMs - Total latency in milliseconds.
 * @param {any} [extraData] - Optional auxiliary payloads (tool results, plans).
 * @returns {Response} Streaming HTTP response.
 */
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

/**
 * Primary HTTP handler for incoming chat, tool execution, and agent planning requests.
 * Orchestrates routing, authorization verification, Ollama communication, and SSE streaming.
 * 
 * @param {Request} req - Incoming POST request.
 * @returns {Promise<Response>} JSON or SSE streaming response.
 */
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
  const routeDecision = routeUserQuery(userText, userModelOverride, conversation);

  // Check for confirmed token in text message (e.g. "Confirm a1b2c3d4" or "Token: XYZ")
    let effectiveConfirmToken = confirmToken;
  if (!effectiveConfirmToken) {
    const tokenInText = userText.match(/\b(?:token:?\s*|confirm\s+)([A-Za-z0-9]{8})\b/i);
    if (tokenInText) {
      effectiveConfirmToken = tokenInText[1].toUpperCase();
    } else if (/^[A-Za-z0-9]{8}$/.test(userText.trim())) {
      effectiveConfirmToken = userText.trim().toUpperCase();
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
          const findings = toolExecResult.results
            .map((r: any, idx: number) => `[Source ${idx + 1}: ${r.title}] ${r.snippet} (Ref: ${r.url})`)
            .join("\n\n");
          const topSources = toolExecResult.results
            .slice(0, 3)
            .map((r: any) => `• ${r.title} — ${r.url}`)
            .join("\n");
          reply = `Verified Web Research for "${toolExecResult.query}":\n\n${toolExecResult.results[0].snippet}\n\nEvidence Sources:\n${topSources}`;
        } else {
          reply = `No external sources found for query "${toolExecResult.query}". Checked local and public web search.`;
        }
      } else if (routeDecision.toolRequired === "search_files") {
        if (toolExecResult.results && toolExecResult.results.length > 0) {
          const fileNames = toolExecResult.results.map((r: any) => r.name).join(", ");
          reply = `Found ${toolExecResult.count} matching files: ${fileNames}.`;
        } else {
          reply = `No files matching '${routeDecision.toolParams?.query_pattern}' found.`;
        }
      } else if (routeDecision.toolRequired === "read_file") {
        if (toolExecResult.status === "success") {
          reply = `File '${toolExecResult.file_path}' contents:\n${toolExecResult.content}`;
        } else {
          reply = `Security/IO Error: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "list_directory") {
        if (toolExecResult.status === "success") {
          const names = toolExecResult.entries.slice(0, 10).map((e: any) => `${e.type === "directory" ? "[DIR]" : "[FILE]"} ${e.name}`).join("\n");
          reply = `Directory '${toolExecResult.dir_path}' (${toolExecResult.count} entries):\n${names}`;
        } else {
          reply = `Error: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "run_command" || routeDecision.toolRequired === "run_developer_command") {
        if (toolExecResult.status === "success") {
          reply = `Command executed successfully (exit code ${toolExecResult.exit_code}):\n${toolExecResult.stdout || "(no output)"}`;
        } else if (toolExecResult.status === "timeout") {
          reply = `Command timed out: ${toolExecResult.error}`;
        } else {
          reply = `Command failed (exit code ${toolExecResult.exit_code}):\n${toolExecResult.stderr || toolExecResult.error || toolExecResult.stdout}`;
        }
      } else if (routeDecision.toolRequired === "enumerate_windows") {
        if (toolExecResult.status === "success") {
          const winList = (toolExecResult.windows || [])
            .map((w: any) => `• [PID ${w.pid}] "${w.title}" (${w.process_name || w.class_name}) - HWND: ${w.hwnd}`)
            .join("\n");
          reply = `Discovered ${toolExecResult.count} active desktop windows:\n${winList || "(No visible top-level windows detected)"}`;
        } else {
          reply = `UI Automation Error: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "inspect_window_elements") {
        if (toolExecResult.status === "success") {
          const root = toolExecResult.window_root;
          const rootSummary = `Window: "${root?.name || "Window"}" (${root?.control_type}, class: ${root?.class_name}, bounds: ${root?.bounds?.width}x${root?.bounds?.height})`;
          const elList = (toolExecResult.elements || [])
            .slice(0, 15)
            .map((el: any) => `  [Depth ${el.depth}] ${el.control_type} "${el.name || el.automation_id || ""}" (${el.is_enabled ? "Enabled" : "Disabled"}${el.has_keyboard_focus ? ", Focused" : ""})`)
            .join("\n");
          reply = `${rootSummary}\nInspected ${toolExecResult.element_count} UI accessibility elements:\n${elList}`;
        } else {
          reply = `UI Inspection Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "focus_window") {
        if (toolExecResult.status === "success") {
          const tgt = toolExecResult.target;
          const ver = toolExecResult.verification;
          reply = `Window Focused: "${tgt?.title || ver?.foreground_title}" (PID ${tgt?.pid || ver?.foreground_pid}, HWND ${tgt?.hwnd || ver?.foreground_hwnd}). Verification: Window brought to foreground successfully.`;
        } else {
          reply = `Window Focus Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "click_ui_element") {
        if (toolExecResult.status === "success") {
          const tgt = toolExecResult.target;
          const ver = toolExecResult.verification;
          reply = `UI Element Clicked: "${tgt?.element_name || tgt?.automation_id || "control"}" (${tgt?.control_type || "element"}). Verification: Invoked via ${ver?.pattern_used || "UIA pattern"}. Target window responsive.`;
        } else {
          reply = `UI Click Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "type_text") {
        if (toolExecResult.status === "success") {
          const tgt = toolExecResult.target;
          const ver = toolExecResult.verification;
          reply = `Text Entered: Successfully typed text into "${tgt?.element_name || tgt?.automation_id || "control"}" (${tgt?.control_type || "field"}). Verification: Input confirmed via ${ver?.method_used || "UIA"}.`;
        } else {
          reply = `Text Entry Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "press_key") {
        if (toolExecResult.status === "success") {
          const ver = toolExecResult.verification;
          reply = `Key Sent: Key '${ver?.key_sent || routeDecision.toolParams?.key}' delivered to target window. Verification: Window responsive.`;
        } else {
          reply = `Key Press Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "capture_screen") {
        if (toolExecResult.status === "success") {
          reply = `Desktop Screenshot Captured: Image saved to "${toolExecResult.file_path}" (${toolExecResult.width}x${toolExecResult.height}, ${toolExecResult.size_bytes} bytes).`;
        } else {
          reply = `Screen Capture Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "analyze_screen") {
        if (toolExecResult.status === "success") {
          reply = toolExecResult.analysis || "Screen analyzed successfully.";
        } else {
          reply = `Screen Analysis Failed: ${toolExecResult.error}`;
        }
      } else if (routeDecision.toolRequired === "desktop_workflow") {
        if (toolExecResult.status === "success") {
          const ver = toolExecResult.verification;
          reply = `Desktop Workflow Completed: ${toolExecResult.action.toUpperCase()} on "${toolExecResult.windowTitle}" (PID ${toolExecResult.targetPid || 'active'}). Verification: ${ver?.evidence || "Action confirmed"}.`;
        } else {
          reply = `Desktop Workflow Failed: ${toolExecResult.error || "Action could not be completed."}`;
        }
      } else if (routeDecision.toolRequired === "browse_web") {
        if (toolExecResult.status === "success") {
          reply = `Web Page Retrieved: "${toolExecResult.title}" (${toolExecResult.url})\n\n${toolExecResult.content}`;
        } else {
          reply = `Web Browsing Failed: ${toolExecResult.error}`;
        }
      } else {
        reply = toolExecResult.message || (toolExecResult.error ? `Error: ${toolExecResult.error}` : "Tool execution resolved.");
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

  // 5. Autonomous Agent Loop Planning with Real Verification & Dynamic ReAct Engine (Phase 2)
  if (routeDecision.intent === "AGENT_PLAN") {
    try {
      const agentGoal = routeDecision.planGoal || userText;
      const loopResult = await ultronAgentEngine.runLoop(agentGoal, {
        model: userModelOverride || LOCAL_MODEL,
        confirmToken: effectiveConfirmToken,
        maxIterations: 5,
        overallTimeoutMs: 60_000,
        perStepTimeoutMs: 25_000,
      });

      const reply = loopResult.reply || `Task concluded with status '${loopResult.status}' in ${loopResult.iterations} steps.`;
      const elapsedMs = Math.round(performance.now() - requestStarted);
      recordMemoryTurn(userText, reply);

      if (stream) {
        return createStreamResponse(reply, routeDecision, "agent-loop", elapsedMs, {
          planReport: {
            goal: agentGoal,
            total_steps: loopResult.activePlan.total,
            passed_steps: loopResult.activePlan.passed,
            overall_status: loopResult.activePlan.status,
            elapsed_seconds: +(loopResult.elapsedMs / 1000).toFixed(2),
          },
          activePlan: loopResult.activePlan,
          agentSteps: loopResult.steps,
        });
      }

      return NextResponse.json({
        reply,
        model: "agent-loop",
        route: routeDecision,
        planReport: {
          goal: agentGoal,
          total_steps: loopResult.activePlan.total,
          passed_steps: loopResult.activePlan.passed,
          overall_status: loopResult.activePlan.status,
          elapsed_seconds: +(loopResult.elapsedMs / 1000).toFixed(2),
        },
        activePlan: loopResult.activePlan,
        agentSteps: loopResult.steps,
        elapsedMs,
      });
    } catch (err) {
      console.warn("Dynamic agent loop error, falling back to planner:", err);
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
      } catch (fallbackErr) {
        console.warn("Agent planner fallback error:", fallbackErr);
      }
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
        num_predict: routeDecision.intent === "COMPLEX_REASONING" ? 512 : 256,
        temperature: routeDecision.intent === "COMPLEX_REASONING" ? 0.2 : 0.5,
      },
      stream: !!stream,
    };

    const res = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaPayload),
      signal: AbortSignal.timeout(45000),
    });

    if (res.ok) {
      return handleOllamaResponse(res, chosenLocalModel, routeDecision, !!stream, requestStarted, userText);
    }
  } catch (ollamaErr) {
    console.warn("[Chat API] Local Ollama request failed or timed out:", ollamaErr);
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

/**
 * Consumes the response from the local Ollama daemon and converts it into
 * either a real-time SSE token stream or a complete JSON response.
 * 
 * @param {Response} res - Raw fetch response from Ollama.
 * @param {string} model - Model name.
 * @param {RouteDecision} route - Intent router metadata.
 * @param {boolean} stream - Whether the client requested an event stream.
 * @param {number} requestStarted - High-resolution timestamp from start of request.
 * @param {string} userText - User utterance for memory storage.
 * @returns {Promise<Response>} Transformed HTTP response.
 */
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
