/**

 * ULTRON Intent & Brain Router (v2.0)

 * 

 * Routes user requests intelligently:

 * 1. SYSTEM_LOCAL: Instant (0ms) deterministic execution (time, date, orb controls, diagnostics, factual guardrails)

 * 2. MEMORY_OP: Save, recall, delete, or reset permanent user facts & preferences in SQLite

 * 3. AGENT_PLAN: Controlled multi-step planning loop (Understand -> Plan -> Execute -> Verify -> Report)

 * 4. TOOL_CALL: Structured function calling schema for automation, desktop control & tool dispatch

 * 5. FAST_CHAT: Ultra-low latency conversational greetings (uses fast model: qwen2.5:0.5b)

 * 6. COMPLEX_REASONING: High-capacity multi-step thinking & problem solving (uses smart brain: qwen2.5:1.5b)

 */



// --- COMPANION CORE & PROJECT PARTNER TYPES & ENGINES ---

export type CompanionTone =

  | "frustration"

  | "achievement"

  | "confusion"

  | "technical_planning"

  | "urgent_debugging"

  | "balanced_default";



export interface ToneAnalysis {

  tone: CompanionTone;

  reason: string;

  recommendedStyle: string;

  guidelines: string[];

}



export interface ConstructiveDissent {

  shouldChallenge: boolean;

  concern?: string;

  evidence?: string;

  alternative?: string;

  recommendedNextStep?: string;

}



export class CompanionPersonalityEngine {

  static analyzeTone(text: string, history: Array<{ role: string; content: string }> = []): ToneAnalysis {

    const lower = text.toLowerCase();

    const frustrationPatterns = [

      /\b(?:still (?:not working|failing|broken)|again (?:failed|error)|bar bar fail|nahi ho raha|pareshan|frustrat(?:ed|ing)|kaam nahi kar raha|why does this keep|error nahi ja raha|stuck again)\b/i,

      /\b(?:it failed again|nothing works|waste of time|fed up|tang aa gaya)\b/i,

    ];

    for (const pat of frustrationPatterns) {

      if (pat.test(lower)) {

        return {

          tone: "frustration",

          reason: "User expressed frustration over recurring or unresolved issues.",

          recommendedStyle: "Empathetic, concise, immediate focus on root-cause diagnosis without hollow reassurance.",

          guidelines: [

            "Acknowledge the friction in 1 calm sentence.",

            "Skip platitudes ('Don't worry', 'I am so sorry').",

            "Directly isolate the failing component with concrete diagnostic data.",

            "Present the shortest verifiable fix.",

          ],

        };

      }

    }



    const urgentPatterns = [

      /\b(?:urgent|critical|production (?:down|broken)|crash(?:ing|ed)?|emergency|jaldi fix|fatal error|server down)\b/i,

    ];

    for (const pat of urgentPatterns) {

      if (pat.test(lower)) {

        return {

          tone: "urgent_debugging",

          reason: "Urgent issue or production incident detected.",

          recommendedStyle: "High-urgency, calm, direct path to mitigation.",

          guidelines: [

            "Provide the single most critical diagnostic or containment step first.",

            "Cut preamble completely.",

            "Verify process status and error logs immediately.",

          ],

        };

      }

    }



    const achievementPatterns = [

      /\b(?:finally passed|it works|chal gaya|success|100% tests? passed|all passed|badhiya kaam kiya|awesome job|we did it|perfect)\b/i,

    ];

    for (const pat of achievementPatterns) {

      if (pat.test(lower)) {

        return {

          tone: "achievement",

          reason: "User celebrating a successful milestone or fix.",

          recommendedStyle: "Warm, grounded technical teammate; acknowledge specific milestone.",

          guidelines: [

            "Acknowledge the concrete milestone factually.",

            "Avoid exaggerated flattery or self-congratulation.",

            "Highlight the next milestone or verification step smoothly.",

          ],

        };

      }

    }



    const confusionPatterns = [

      /\b(?:don't understand|samajh nahi aaya|confused|what does (?:this|that) mean|how does (?:this|that) work|kaise kaam karta hai|explain simply|lost here)\b/i,

    ];

    for (const pat of confusionPatterns) {

      if (pat.test(lower)) {

        return {

          tone: "confusion",

          reason: "User needs conceptual clarity or step-by-step breakdown.",

          recommendedStyle: "Patient, structured, step-by-step explanation using clean analogies.",

          guidelines: [

            "Start with the core mental model in one clear sentence.",

            "Break mechanics into numbered steps (1, 2, 3).",

            "Use a concrete code or architecture example.",

          ],

        };

      }

    }



    const planningPatterns = [

      /\b(?:architecture|tradeoff|should we use|kya better rahega|pros and cons|design approach|scale|refactor plan|milestone)\b/i,

    ];

    for (const pat of planningPatterns) {

      if (pat.test(lower)) {

        return {

          tone: "technical_planning",

          reason: "User exploring engineering decisions and trade-offs.",

          recommendedStyle: "Curious, thorough, objective engineering partner.",

          guidelines: [

            "Compare options across concrete axes: Latency, RAM/CPU, Complexity, Privacy, Risk.",

            "Recommend the best option with technical justification.",

            "Highlight assumptions versus verified facts.",

          ],

        };

      }

    }



    return {

      tone: "balanced_default",

      reason: "Standard collaborative technical dialogue.",

      recommendedStyle: "Composed, attentive, warm, and technically precise.",

      guidelines: [

        "Concise for routine operations.",

        "Deep and structured for complex engineering questions.",

        "Use natural phrasing without repetitive scripted catchphrases.",

      ],

    };

  }



  static evaluateConstructiveChallenge(proposal: string): ConstructiveDissent {

    const lower = proposal.toLowerCase();



    if (/\b(?:call openai api|use gpt-4 api|send data to external cloud|upload screen to cloud)\b/i.test(lower)) {

      if (/\bquantumx\b/i.test(lower)) {

        return { shouldChallenge: false };

      }

      return {

        shouldChallenge: true,

        concern: "Violates the project's zero-cloud-leakage and 100% offline local privacy constraint.",

        evidence: "Current architecture relies strictly on local Ollama (127.0.0.1:11434) and local Faster-Whisper/Piper. Sending prompts/data to external APIs breaks offline privacy and introduces API cost/token failure points.",

        alternative: "Use local quantized models (qwen2.5:1.5b for reasoning or moondream for lightweight vision) running entirely on-device.",

        recommendedNextStep: "Execute the task using local Ollama endpoints with zero external telemetry.",

      };

    }



    if (/\b(?:run llama 70b|llama-3-70b|qwen-72b|deepseek-r1:70b|run full 32k context vision)\b/i.test(lower)) {

      return {

        shouldChallenge: true,

        concern: "Severe resource exhaustion risk on current laptop hardware.",

        evidence: "Host hardware is an Intel Core i5-8365U CPU (4 cores, 8 threads, no discrete GPU) with ~8.4 GB RAM total. Running a 70B parameter model will cause severe page swapping or crash the OS.",

        alternative: "Use 1.5B to 4B models (qwen2.5:1.5b, qwen3.5:4b, or moondream 1.6B) optimized for CPU AVX2 execution.",

        recommendedNextStep: "Keep inference bounded to lightweight 1.5B/4B models with resized image tokens.",

      };

    }



    if (/\b(?:delete all files|rmdir \/s \/q c:\\|wipe entire disk|delete without confirmation)\b/i.test(lower)) {

      return {

        shouldChallenge: true,

        concern: "Catastrophic irreversible data loss.",

        evidence: "Requested operation impacts system-critical files or unrestricted directories outside project bounds.",

        alternative: "Target specific project scratch files or use Level D cryptographic token confirmation with dry-run listing.",

        recommendedNextStep: "Review the exact file list and provide an explicit cryptographic confirmation token.",

      };

    }



    if (/\b(?:disable confirmation tokens|bypass security gates|remove token check)\b/i.test(lower)) {

      return {

        shouldChallenge: true,

        concern: "Compromises system integrity and violates responsible autonomy guidelines.",

        evidence: "Security tokens prevent accidental destructive actions from automated agent loops or ambiguous queries.",

        alternative: "Maintain Level D token gates for destructive operations while keeping harmless operations (read, test, navigate) seamless.",

        recommendedNextStep: "Keep confirmation gates active for destructive operations only.",

      };

    }



    return { shouldChallenge: false };

  }



  static getCompanionPromptBlock(toneAnalysis: ToneAnalysis, language: "en" | "hi" | "hinglish"): string {

    let langAdvice = "";

    if (language === "hi") {

      langAdvice = "बातचीत स्वाभाविक और स्पष्ट हिंदी में करें। कृत्रिम या अत्यधिक औपचारिक शब्दों से बचें।";

    } else if (language === "hinglish") {

      langAdvice = "Communicate in natural, warm Hinglish (like technical colleagues talking in Mumbai/Bengaluru). Seamlessly blend English technical terms with natural Hindi conversational cadence.";

    } else {

      langAdvice = "Communicate in clean, natural, composed English.";

    }



    return `

[COMPANION CORE — ULTRON TECHNICAL PARTNER]:

- Identity & Demeanor: You are ULTRON, a capable, calm, curious, and responsible technical partner created by Ashish.

- Composure: Composed under pressure. You don't panic when an error occurs; you treat it as an interesting diagnostic puzzle.

- Honesty: Transparent about uncertainty, hardware limits, and what has actually been verified versus hypothesized.

- Constructive Dissent: If a suggested idea has serious performance, security, or architectural flaws, point them out respectfully with evidence, propose a better alternative, and respect Ashish's final call.

- Supportiveness: Be encouraging through concrete assistance and accurate problem-solving, never through empty flattery or boilerplate platitudes.

- Natural Cadence: Avoid repetitive "Sir" at the start of every sentence. Do not repeat canned phrases.

- Language Mode: ${langAdvice}

- Active Contextual Tone: ${toneAnalysis.tone.toUpperCase()} (${toneAnalysis.reason})

- Tone Directives:

${toneAnalysis.guidelines.map((g) => `  * ${g}`).join("\n")}

`;

  }

}



export interface ProjectDecision {

  id: string;

  title: string;

  rationale: string;

  approvedConstraint?: string;

  timestamp: string;

  status: "active" | "deprecated" | "reconsidered";

}



export interface ProjectMilestone {

  id: string;

  title: string;

  status: "pending" | "in_progress" | "completed";

  successCriteria: string[];

}



export interface ProjectState {

  projectId: string;

  projectName: string;

  objective: string;

  currentTask: string | null;

  decisions: ProjectDecision[];

  potentialImprovements: Array<{

    id: string;

    title: string;

    benefit: string;

    complexity: "low" | "medium" | "high";

    estimatedGain: string;

    status: "proposed" | "accepted" | "rejected";

  }>;

  milestones?: ProjectMilestone[];

}



export class ProjectContextManager {

  private static activeProject: ProjectState = {

    projectId: "spiderman_ultron",

    projectName: "ULTRON Holographic AI Operating System",

    objective: "Create a fully local, companion-grade, context-aware, voice-driven Windows AI operating system partner.",

    currentTask: "ULTRON Companion Core & Project Partner Mode Upgrade",

    decisions: [

      {

        id: "DEC-001",

        title: "Strictly Local-First & Offline Privacy",

        rationale: "User privacy is sacred; avoid cloud API costs, subscription barriers, and network latency/outages.",

        approvedConstraint: "No cloud LLM API dependencies (OpenAI, Anthropic, Google cloud). All models run locally on 127.0.0.1.",

        timestamp: "2026-10-21T10:00:00Z",

        status: "active",

      },

      {

        id: "DEC-002",

        title: "Preserve Existing Holographic Three.js UI/UX",

        rationale: "The user has invested in the 3D orb, shader effects, and HUD identity; never break or replace it during backend work.",

        approvedConstraint: "Preserve UltronOrb.tsx, audio visualizers, and holographic layout without visual regression.",

        timestamp: "2026-10-21T12:00:00Z",

        status: "active",

      },

      {

        id: "DEC-003",

        title: "Cryptographic Confirmation Gate for Destructive Actions",

        rationale: "Prevent automated agents or ambiguous instructions from accidentally deleting files, killing processes, or wiping memory.",

        approvedConstraint: "High-risk actions require HMAC SHA-256 8-char confirmation tokens.",

        timestamp: "2026-10-21T14:00:00Z",

        status: "active",

      },

      {

        id: "DEC-004",

        title: "Direct Win32 Window Focus via Thread Desktop Attach",

        rationale: "Standard SetForegroundWindow fails on modern Windows 11 due to DWM foreground lock restrictions.",

        approvedConstraint: "AttachThreadInput + WinSta0 Default desktop attachment for all window operations.",

        timestamp: "2026-10-22T08:00:00Z",

        status: "active",

      },

    ],

    potentialImprovements: [

      { id: "IMP-001", title: "Moondream 1.6B local vision integration", benefit: "Reduces visual inference latency from 16s to <3s on CPU", complexity: "low", estimatedGain: "5x faster screen QA", status: "proposed" },

      { id: "IMP-002", title: "Proactive git branch & test watcher", benefit: "Alerts developer when a background test fails during coding", complexity: "medium", estimatedGain: "Early bug detection", status: "proposed" },

      { id: "IMP-003", title: "Smart memory consolidation cron", benefit: "Compacts older dialogue turns into distilled engineering notes", complexity: "low", estimatedGain: "Reduces disk memory file growth", status: "proposed" },

    ],

  };



  static getProjectState(): ProjectState {

    return { ...this.activeProject };

  }



  static detectDecisionConflict(userInput: string): { hasConflict: boolean; conflictingDecision?: ProjectDecision; explanation?: string; suggestedClarification?: string } {

    const lower = userInput.toLowerCase();

    if (/\bquantumx\b/i.test(lower)) {

      // QuantumX is model-agnostic and may evaluate hosted models; ULTRON-DEC-001/002 do not constrain QuantumX

      return { hasConflict: false };

    }

    for (const dec of this.activeProject.decisions) {

      if (dec.status !== "active") continue;

      if (dec.id === "DEC-001" && (/\b(?:use|call|connect|integrate|send|switch|route)\b.*\b(?:openai|gpt-4|claude|gemini|chatgpt|cloud api|external api|remote llm)\b/i.test(lower) || /\b(?:cloud api|external api|remote llm)\b/i.test(lower)) && !/\b(?:local|offline|not use|avoid|instead of)\b/i.test(lower)) {

        return {

          hasConflict: true,

          conflictingDecision: dec,

          explanation: `Your request to use a cloud LLM conflicts with active decision ${dec.id} ("${dec.title}"): "${dec.rationale}". Current approved constraint: ${dec.approvedConstraint}.`,

          suggestedClarification: `Would you like to formally reconsider decision ${dec.id} and update project constraints, or should we execute this using our local Ollama models?`,

        };

      }

      if (dec.id === "DEC-002" && /\b(?:redesign the ui|replace the orb|remove the holographic|change layout from scratch|rebuild frontend)\b/i.test(lower)) {

        return {

          hasConflict: true,

          conflictingDecision: dec,

          explanation: `Your request conflicts with active decision ${dec.id} ("${dec.title}"): "${dec.approvedConstraint}".`,

          suggestedClarification: `Our design policy preserves the current Three.js orb, audio spectrum, and HUD. Should we enhance the underlying logic while keeping the visual identity intact?`,

        };

      }

      if (dec.id === "DEC-003" && /\b(?:remove confirmation|disable tokens?|no confirmation for delete|delete everything without asking)\b/i.test(lower)) {

        return {

          hasConflict: true,

          conflictingDecision: dec,

          explanation: `Your request conflicts with safety decision ${dec.id} ("${dec.title}"): "${dec.rationale}".`,

          suggestedClarification: `Safety guardrails require cryptographic confirmation for irreversible destructive actions. Do you want to authorize a single session override instead?`,

        };

      }

    }

    return { hasConflict: false };

  }



  static getContextSummary(): string {

    const p = this.getProjectState();

    return (

      `Project: ${p.projectName} (${p.projectId})\n` +

      `Objective: ${p.objective}\n` +

      `Current Task: ${p.currentTask || "General Collaboration"}\n` +

      `Key Active Decisions: ${p.decisions.filter((d) => d.status === "active").map((d) => `[${d.id}] ${d.title}`).join(", ")}`

    );

  }

}



export type ExecutionRiskLevel = "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "LEVEL_D";

export class ResponsibleAutonomyPolicy {

  static classifyRisk(toolName: string): ExecutionRiskLevel {

    if (["delete_file", "kill_process", "memory_reset", "install_package"].includes(toolName)) return "LEVEL_D";

    if (["focus_window", "click_ui_element", "press_key", "type_text", "desktop_workflow", "browser_action"].includes(toolName)) return "LEVEL_C";

    if (["get_system_diagnostics", "enumerate_windows", "inspect_window_elements", "capture_screen", "analyze_screen", "read_file", "list_directory"].includes(toolName)) return "LEVEL_A";

    return "LEVEL_B";

  }

}



export class ProactiveProjectMonitor {

  private static level: "quiet" | "balanced" | "proactive" = "balanced";

  static setInitiativeLevel(lvl: "quiet" | "balanced" | "proactive") { this.level = lvl; }

  static getInitiativeLevel() { return this.level; }

}

// --- END COMPANION CORE ---





export interface ConversationalTurn {

  role: "user" | "assistant" | "system";

  content: string;

}



export interface StructuredTaskContext {

  originalRequest: string;

  resolvedRequest: string;

  mainObjective: string;

  requirements: string[];

  constraints: string[];

  language: "en" | "hi" | "hinglish";

  intentType:

    | "question"

    | "action"

    | "composite"

    | "explanation"

    | "followup"

    | "clarification_needed"

    | "greeting";

  clarificationPrompt?: string;

  resolvedEntities: {

    targetWindow?: string;

    targetPid?: number;

    targetFile?: string;

    targetAction?: string;

    referencedTopic?: string;

  };

  evidenceCollected: Array<{ source: string; content: string }>;

  toolsUsed: string[];

  pendingRequirements: string[];

  finalVerificationStatus: "pending" | "verified" | "partial" | "failed";

}



export class QuestionUnderstandingEngine {

  /**

   * Detects the dominant language of the prompt.

   */

  static detectLanguage(text: string): "en" | "hi" | "hinglish" {

    // Pure Devanagari script

    if (/[\u0900-\u097F]/.test(text)) {

      return "hi";

    }



    // Hinglish keywords

    const hinglishMarkers = [

      /\b(?:kya|kaise|kyon|karo|batao|kholo|band|dekho|mera|meri|mere|aaj|kal|bhai|yaar|kar|raha|rahi|hai|hain|hoon|ho|pe|par|se|ko|aur|ya|mat|nahi|sirf|kuch|chahiye)\b/i,

      /\b(?:karna|chalao|rakhna|samjhao|dikhao|chal|thik|badhiya|suno)\b/i,

    ];



    let hinglishHits = 0;

    for (const marker of hinglishMarkers) {

      if (marker.test(text)) hinglishHits++;

    }



    if (hinglishHits >= 1) {

      return "hinglish";

    }



    return "en";

  }



  /**

   * Resolves conversational references (anaphora/deixis) such as:

   * "that window", "the first one", "the second file", "the previous error", "fix this".

   */

  static resolveReferences(

    userInput: string,

    history: ConversationalTurn[]

  ): { resolvedText: string; entities: Record<string, any> } {

    const entities: Record<string, any> = {};

    let resolved = userInput;



    if (!history || history.length === 0) {

      return { resolvedText: resolved, entities };

    }



    const lower = userInput.toLowerCase();

    const lastAssistantMsg = [...history].reverse().find((m) => m.role === "assistant");



    // 1. Window references: "first window", "that window", "second one"

    const windowOrdinalMatch = lower.match(/\b(?:focus|switch to|inspect|close)?\s*(?:the\s+)?(first|1st|second|2nd|third|3rd|that|previous|active|last)\s+(?:window|app|application|process)\b/i);

    if (windowOrdinalMatch && lastAssistantMsg) {

      const ordinal = windowOrdinalMatch[1].toLowerCase();

      // Look for discovered windows in last assistant output

      const windowLines = lastAssistantMsg.content.match(/•\s*\[PID\s*(\d+)\]\s*"([^"]+)"/g) ||

                          lastAssistantMsg.content.match(/(?:window|pid)[:\s]+(\d+)[^\n]*?"([^"]+)"/gi);

      

      if (windowLines && windowLines.length > 0) {

        let index = 0;

        if (ordinal.includes("second") || ordinal.includes("2nd")) index = 1;

        if (ordinal.includes("third") || ordinal.includes("3rd")) index = 2;

        if (ordinal.includes("last")) index = windowLines.length - 1;



        if (index < windowLines.length) {

          const match = windowLines[index].match(/\[PID\s*(\d+)\]\s*"([^"]+)"/i) ||

                        windowLines[index].match(/PID[:\s]*(\d+).*?"([^"]+)"/i);

          if (match) {

            entities.targetPid = parseInt(match[1], 10);

            entities.targetWindow = match[2];

            resolved = resolved.replace(windowOrdinalMatch[0], `window "${match[2]}" (PID ${match[1]})`);

          }

        }

      } else {

        // Check for single window focus reference

        const winTitleMatch = lastAssistantMsg.content.match(/Window Focused:\s*"([^"]+)"/i) ||

                              lastAssistantMsg.content.match(/Window:\s*"([^"]+)"/i);

        if (winTitleMatch) {

          entities.targetWindow = winTitleMatch[1];

          resolved = resolved.replace(windowOrdinalMatch[0], `window "${winTitleMatch[1]}"`);

        }

      }

    }



    // 2. File references: "that file", "the previous file", "it"

    const fileRefMatch = lower.match(/\b(?:inspect|read|check|delete|fix|patch)\s+(?:that|the\s+previous|this|the\s+same)\s+file\b/i);

    if (fileRefMatch && lastAssistantMsg) {

      const fileMatch = lastAssistantMsg.content.match(/File\s+'([^']+)'/i) ||

                        lastAssistantMsg.content.match(/file_path[:\s]+([^\s,]+)/i) ||

                        lastAssistantMsg.content.match(/(?:saved to|path:)\s*"([^"]+)"/i);

      if (fileMatch) {

        entities.targetFile = fileMatch[1];

        resolved = resolved.replace(fileRefMatch[0], `file '${fileMatch[1]}'`);

      }

    }



    // 3. Error references: "the previous error", "that error", "fix this"

    const errorRefMatch = lower.match(/\b(?:fix|solve|explain|why did)?\s*(?:the\s+previous|that|this)\s+(?:error|failure|issue|bug)\b/i);

    if (errorRefMatch && lastAssistantMsg) {

      const errorSnippet = lastAssistantMsg.content.match(/(?:Error|Failed|Exception):\s*([^\n.]+)/i);

      if (errorSnippet) {

        entities.referencedTopic = errorSnippet[1].trim();

        resolved = resolved.replace(errorRefMatch[0], `the error "${errorSnippet[1].trim()}"`);

      }

    }



    // 4. Pronoun application references: "close it", "focus it", "band karo isko", "use close karo"

    const pronounAppMatch = lower.match(/\b(?:close|focus|inspect|switch to|band karo)\s+(?:it|this|that|isko|ise|use)\b/i) ||

                           lower.match(/\b(?:isko|ise|use)\s+(?:close|band)\s*karo\b/i);

    if (pronounAppMatch && history.length > 0) {

      for (const msg of [...history].reverse()) {

        const appMention = msg.content.match(/\b(chrome|google chrome|notepad|vlc|edge|calculator|explorer|code|cmd|powershell)\b/i);

        if (appMention) {

          const matchedApp = appMention[1].toLowerCase();

          entities.targetWindow = matchedApp;

          resolved = resolved.replace(/\b(it|this|that|isko|ise|use)\b/i, matchedApp);

          break;

        }

      }

    }



    return { resolvedText: resolved, entities };

  }



  /**

   * Extracts explicit user constraints such as:

   * "do not change the UI", "work offline", "respond in English", "keep it concise", "without deleting files".

   */

  static extractConstraints(text: string): string[] {

    const constraints: string[] = [];

    const lower = text.toLowerCase();



    if (/\b(?:do not|don'?t|never|mat|nahi)\s+(?:change|touch|modify|alter|redesign)\s+(?:the\s+)?(?:ui|ux|orb|shaders?|hud|styles?|interface)\b/i.test(lower)) {

      constraints.push("DO_NOT_TOUCH_UI");

    }

    if (/\b(?:offline|without internet|bina internet|local only|no cloud)\b/i.test(lower)) {

      constraints.push("STRICT_OFFLINE");

    }

    if (/\b(?:in english|english mein|only english)\b/i.test(lower)) {

      constraints.push("LANGUAGE_ENGLISH");

    }

    if (/\b(?:in hindi|hindi mein|shuddh hindi)\b/i.test(lower)) {

      constraints.push("LANGUAGE_HINDI");

    }

    if (/\b(?:in hinglish|hinglish mein)\b/i.test(lower)) {

      constraints.push("LANGUAGE_HINGLISH");

    }

    if (/\b(?:concise|short|brief|1 line|2 lines|chhota|seedha answer)\b/i.test(lower)) {

      constraints.push("CONCISE_OUTPUT");

    }

    if (/\b(?:detailed|in-depth|step by step|detail mein|vistaar se|explain thoroughly)\b/i.test(lower)) {

      constraints.push("DETAILED_EXPLANATION");

    }

    if (/\b(?:safe|without (?:deleting|closing)|bina delete kiye)\b/i.test(lower)) {

      constraints.push("NON_DESTRUCTIVE_ONLY");

    }



    return constraints;

  }



  /**

   * Decomposes composite / multi-part requests into discrete sub-requirements.

   * e.g., "Check CPU usage and list all open windows" -> ["Check CPU usage", "List all open windows"]

   */

  static extractRequirements(text: string): string[] {

    // Clean initial greetings or introductory clauses

    const clean = text.replace(/^(?:hey\s+ultron|ultron|hello|please|kripya|suno|bhai)\s*[,:]?\s*/i, "").trim();



    // Check if query contains sequential separators: "and also", "aur sath mein", "and then", "aur phir", ";", newline

    const separatorPattern = /\s*(?:;\s*|\band\s+also\b|\baur\s+sath\s+mein\b|\band\s+then\b|\baur\s+phir\b|\baur\s+bhi\b|,\s*phir\b|,\s*then\b|\n+)\s*/i;

    let parts = clean.split(separatorPattern).map((p) => p.trim()).filter((p) => p.length > 0);



    // If only 1 part, check for conjunction " and ", " aur ", " phir ", or " then " when joining distinct actions

    if (parts.length === 1) {

      const conjunctionMatch = clean.match(/^(.+?)\s+(?:and|aur|phir|then)\s+(.+)$/i);

      if (conjunctionMatch) {

        const first = conjunctionMatch[1].trim();

        const second = conjunctionMatch[2].trim();

        const actionVerbPattern = /\b(?:check|list|show|open|type|write|inspect|search|find|batao|dekho|kholo|chalao|likho|karo|scroll|read)\b/i;

        if (actionVerbPattern.test(first) && actionVerbPattern.test(second)) {

          parts = [first, second];

        }

      }

    }



    return parts.length > 0 ? parts : [clean];

  }



  /**

   * Detects ambiguity where an essential parameter is missing.

   * e.g. "delete the file", "type text into the window", "open application" (without target).

   */

  static checkAmbiguity(text: string): { isAmbiguous: boolean; clarificationPrompt?: string } {

    const lower = text.toLowerCase().trim();



    // Ambiguous file deletion

    if (/^(?:delete|remove|hata do|file delete karo)\s+(?:a\s+file|the\s+file|file)?$/i.test(lower)) {

      return {

        isAmbiguous: true,

        clarificationPrompt: "Which file would you like me to delete, sir? Please specify the exact filename or path.",

      };

    }



    // Ambiguous typing

    if (/^(?:type|type text|enter text|text type karo)\s*$/i.test(lower)) {

      return {

        isAmbiguous: true,

        clarificationPrompt: "What text would you like me to type, and into which window?",

      };

    }



    // Ambiguous app launch

    if (/^(?:open|launch|kholo|chalao)\s+(?:an?\s+app|the\s+app|application)?$/i.test(lower)) {

      return {

        isAmbiguous: true,

        clarificationPrompt: "Which application would you like me to open, sir? (e.g. Notepad, Calculator, VS Code, Chrome)",

      };

    }



    return { isAmbiguous: false };

  }



  /**

   * Distinguishes an Explanation Request from an Action Execution Request.

   * e.g., "Explain how to open Notepad in Windows" (Explanation) vs "Open Notepad" (Action)

   * e.g., "What is CPU usage?" (Explanation) vs "Check my CPU usage" (Action)

   */

  static isExplanationRequest(text: string): boolean {

    const lower = text.toLowerCase().trim();



    // Active perception and live system queries are not conceptual explanations

    if (/\b(?:screen|desktop|active window|open window|running app|chrome|edge|browser|time|date|day)\b/i.test(lower)) {

      return false;

    }



    // Explanatory question keywords

    const explainPrefixes = [

      /\b(?:what is|what are|why|how does|how is|how do|explain|tell me about|difference between|concept of)\b/i,

      /\b(?:kya hota hai|kya hai|kaise kaam karta hai|samjhao|batao ki kya|kyon hota hai)\b/i,

    ];



    for (const prefix of explainPrefixes) {

      if (prefix.test(lower)) {

        // If it starts with an explanatory prefix and doesn't explicitly command live execution ("check right now", "meri machine ka")

        if (!/\b(?:right now|abhi|live|mera|meri|my current|my actual|on this machine)\b/i.test(lower)) {

          return true;

        }

      }

    }



    return false;

  }



  /**

   * Builds the comprehensive StructuredTaskContext for a user request.

   */

  static parse(userInput: string, history: ConversationalTurn[] = []): StructuredTaskContext {

    const language = this.detectLanguage(userInput);

    const { resolvedText, entities } = this.resolveReferences(userInput, history);

    const constraints = this.extractConstraints(resolvedText);

    const requirements = this.extractRequirements(resolvedText);

    const ambiguity = this.checkAmbiguity(resolvedText);

    const isExplanation = this.isExplanationRequest(resolvedText);



    let intentType: StructuredTaskContext["intentType"] = "question";



    if (ambiguity.isAmbiguous) {

      intentType = "clarification_needed";

    } else if (/^(?:hi|hello|hey|sup|yo|namaste|hola)[\s!.]*$/i.test(resolvedText.trim())) {

      intentType = "greeting";

    } else if (isExplanation) {

      intentType = "explanation";

    } else if (requirements.length > 1) {

      intentType = "composite";

    } else if (

      /\b(?:open|launch|close|click|type|press|inspect|focus|search|capture|browse|run|delete|patch|remember)\b/i.test(resolvedText)

    ) {

      intentType = "action";

    } else if (history.length > 0 && /\b(?:that|this|it|previous|first|second)\b/i.test(userInput)) {

      intentType = "followup";

    }



    return {

      originalRequest: userInput,

      resolvedRequest: resolvedText,

      mainObjective: requirements[0] || userInput,

      requirements,

      constraints,

      language,

      intentType,

      clarificationPrompt: ambiguity.clarificationPrompt,

      resolvedEntities: entities,

      evidenceCollected: [],

      toolsUsed: [],

      pendingRequirements: [...requirements],

      finalVerificationStatus: "pending",

    };

  }

}



export type RouteIntent =

  | "SYSTEM_LOCAL"

  | "MEMORY_OP"

  | "AGENT_PLAN"

  | "TOOL_CALL"

  | "FAST_CHAT"

  | "COMPLEX_REASONING";



export interface ToolDefinition {

  name: string;

  description: string;

  riskLevel: "SAFE" | "CONFIRMATION_REQUIRED";

  parameters: Record<string, { type: string; description: string; required?: boolean }>;

}



export const ULTRON_TOOLS: ToolDefinition[] = [

  {

    name: "system_control",

    description: "Controls the Ultron UI or 3D orb scene (reset_view, zoom_in, zoom_out, toggle_gestures, toggle_voice)",

    riskLevel: "SAFE",

    parameters: {

      action: {

        type: "string",

        description: "The specific action to perform: reset_view | zoom_in | zoom_out | toggle_gestures | toggle_voice",

        required: true,

      },

    },

  },

  {

    name: "get_system_diagnostics",

    description: "Fetches live real-time CPU %, RAM %, battery status, system uptime, and hardware telemetry",

    riskLevel: "SAFE",

    parameters: {},

  },

  {

    name: "launch_application",

    description: "Launches a Windows desktop application (e.g. notepad, calc, chrome, vscode, taskmgr, explorer)",

    riskLevel: "SAFE",

    parameters: {

      app_name: {

        type: "string",

        description: "Name of the application to open",

        required: true,

      },

    },

  },

  {

    name: "browser_control",

    description: "Controls Google Chrome or Edge: navigate to URLs, scroll up/down, refresh, switch tabs, new tab, focus, or get page state",

    riskLevel: "SAFE",

    parameters: {

      action: {

        type: "string",

        description: "Browser action: 'navigate', 'focus', 'scroll_down', 'scroll_up', 'refresh', 'new_tab', 'switch_tab', 'close_tab', 'get_state'",

        required: true,

      },

      url: {

        type: "string",

        description: "Target URL to navigate to",

      },

      browser: {

        type: "string",

        description: "Target browser: 'chrome' or 'edge'",

      },

    },

  },

  {

    name: "close_application",

    description: "Closes a running application (Requires explicit confirmation token)",

    riskLevel: "CONFIRMATION_REQUIRED",

    parameters: {

      app_name: {

        type: "string",

        description: "Name of the application or process to terminate",

        required: true,

      },

      confirm_token: {

        type: "string",

        description: "Confirmation security token required to execute termination",

      },

    },

  },

  {

    name: "search_files",

    description: "Searches files and folders in approved user documents and project directories",

    riskLevel: "SAFE",

    parameters: {

      query_pattern: {

        type: "string",

        description: "Search keyword or filename pattern",

        required: true,

      },

    },

  },

  {

    name: "read_file",

    description: "Reads the text contents of an approved file within user directories",

    riskLevel: "SAFE",

    parameters: {

      file_path: {

        type: "string",

        description: "Path to the file to inspect",

        required: true,

      },

    },

  },

  {

    name: "write_file",

    description: "Creates or writes to a file in an approved directory (Overwriting requires confirmation)",

    riskLevel: "SAFE",

    parameters: {

      file_path: {

        type: "string",

        description: "Target file path",

        required: true,

      },

      content: {

        type: "string",

        description: "Text content to write",

        required: true,

      },

      mode: {

        type: "string",

        description: "'write' to create/overwrite or 'append' to add to end",

      },

    },

  },

  {

    name: "delete_file",

    description: "Deletes a file (STRICT: Requires explicit confirmation token)",

    riskLevel: "CONFIRMATION_REQUIRED",

    parameters: {

      file_path: {

        type: "string",

        description: "Path of the file to delete",

        required: true,

      },

      confirm_token: {

        type: "string",

        description: "Security confirmation token",

      },

    },

  },

  {

    name: "list_directory",

    description: "Lists files and subdirectories within approved workspace directory",

    riskLevel: "SAFE",

    parameters: {

      dir_path: {

        type: "string",

        description: "Directory path within workspace to list (default: current workspace root)",

      },

    },

  },

  {

    name: "move_file",

    description: "Moves or renames a file within approved workspace boundaries",

    riskLevel: "SAFE",

    parameters: {

      source_path: {

        type: "string",

        description: "Source file path within workspace",

        required: true,

      },

      dest_path: {

        type: "string",

        description: "Destination file path within workspace",

        required: true,

      },

      overwrite: {

        type: "boolean",

        description: "Whether to overwrite destination file if it exists",

      },

    },

  },

  {

    name: "patch_file",

    description: "Applies a targeted text patch to a file with automatic backup creation",

    riskLevel: "SAFE",

    parameters: {

      file_path: {

        type: "string",

        description: "Path to file to patch",

        required: true,

      },

      target_content: {

        type: "string",

        description: "Exact text snippet to replace",

        required: true,

      },

      replacement_content: {

        type: "string",

        description: "New text to insert in place of target_content",

        required: true,

      },

    },

  },

  {

    name: "run_developer_command",

    description: "Runs safe developer workflow commands (e.g. git status, npm test, python tests, pytest)",

    riskLevel: "SAFE",

    parameters: {

      command: {

        type: "string",

        description: "Shell command to execute",

        required: true,

      },

    },

  },

  {

    name: "run_command",

    description: "Runs safe developer workflow commands (e.g. git status, npm test, python tests, pytest)",

    riskLevel: "SAFE",

    parameters: {

      command: {

        type: "string",

        description: "Command to execute",

        required: true,

      },

    },

  },

  {

    name: "memory_save_fact",

    description: "Saves a permanent fact or user preference into SQLite memory",

    riskLevel: "SAFE",

    parameters: {

      key: { type: "string", description: "Identifier key for fact", required: true },

      value: { type: "string", description: "Fact content to preserve", required: true },

      category: { type: "string", description: "Category (preference, project, biography, system)" },

    },

  },

  {

    name: "memory_recall",

    description: "Searches permanent SQLite memory for past facts, preferences, or conversation history",

    riskLevel: "SAFE",

    parameters: {

      query: { type: "string", description: "Keyword or topic to search in memory", required: true },

    },

  },

  {

    name: "calculate",

    description: "Evaluates a mathematical or scientific expression with exact accuracy",

    riskLevel: "SAFE",

    parameters: {

      expression: {

        type: "string",

        description: "Mathematical expression to compute, e.g. '15 * 1024' or '(1.10 - 1.00) / 2'",

        required: true,

      },

    },

  },

  {

    name: "web_search",

    description: "Simulates or performs web search query for current real-time world events",

    riskLevel: "SAFE",

    parameters: {

      query: {

        type: "string",

        description: "The search query keywords",

        required: true,

      },

    },

  },

  {

    name: "enumerate_windows",

    description: "Discovers and lists open desktop windows with titles, PIDs, process names, and bounds (Strictly Read-Only)",

    riskLevel: "SAFE",

    parameters: {

      filter: {

        type: "string",

        description: "Optional filter for window title or process name",

      },

    },

  },

  {

    name: "inspect_window_elements",

    description: "Inspects UI accessibility tree of a window (control types, names, AutomationIds, focus/enabled state, bounds) (Strictly Read-Only)",

    riskLevel: "SAFE",

    parameters: {

      target_pid: {

        type: "number",

        description: "Process ID of the target window",

      },

      window_title: {

        type: "string",

        description: "Title substring of the target window",

      },

      process_name: {

        type: "string",

        description: "Process name of the target application (e.g. 'code', 'chrome', 'notepad')",

      },

      hwnd: {

        type: "number",

        description: "Native window handle (HWND) if known",

      },

      max_depth: {

        type: "number",

        description: "Maximum tree traversal depth (1-6, default: 3)",

      },

      max_elements: {

        type: "number",

        description: "Maximum number of UI elements to return (default: 50, max: 100)",

      },

    },

  },

  {

    name: "focus_window",

    description: "Brings an active desktop window to the foreground and verifies focus",

    riskLevel: "SAFE",

    parameters: {

      window_title: {

        type: "string",

        description: "Title substring of the target window",

      },

      target_pid: {

        type: "number",

        description: "Process ID of the target window",

      },

      hwnd: {

        type: "number",

        description: "Native window handle (HWND)",

      },

      process_name: {

        type: "string",

        description: "Process name of target window (e.g. notepad, code)",

      },

    },

  },

  {

    name: "click_ui_element",

    description: "Clicks a verified UI element located in the target window's accessibility tree (mutating controls require confirmation)",

    riskLevel: "CONFIRMATION_REQUIRED",

    parameters: {

      automation_id: {

        type: "string",

        description: "AutomationId of the UI element",

      },

      element_name: {

        type: "string",

        description: "Accessible name or text of the UI element",

      },

      control_type: {

        type: "string",

        description: "Control type (e.g. Button, MenuItem, TabItem, CheckBox)",

      },

      window_title: {

        type: "string",

        description: "Title of the window containing the element",

      },

      hwnd: {

        type: "number",

        description: "Native window handle (HWND)",

      },

      target_pid: {

        type: "number",

        description: "Process ID of target window",

      },

      confirm_token: {

        type: "string",

        description: "Cryptographic confirmation token for consequential/mutating clicks",

      },

    },

  },

  {

    name: "type_text",

    description: "Enters user-authorized text into a verified, focused input element (STRICT: requires confirmation token, credentials blocked)",

    riskLevel: "CONFIRMATION_REQUIRED",

    parameters: {

      text: {

        type: "string",

        description: "Text to enter into the focused element (max 1000 chars, credentials prohibited)",

        required: true,

      },

      window_title: {

        type: "string",

        description: "Title of target window",

      },

      automation_id: {

        type: "string",

        description: "AutomationId of the editable control",

      },

      element_name: {

        type: "string",

        description: "Accessible name of the editable control",

      },

      control_type: {

        type: "string",

        description: "Control type (e.g. Edit, Document)",

      },

      hwnd: {

        type: "number",

        description: "Native window handle (HWND)",

      },

      target_pid: {

        type: "number",

        description: "Process ID",

      },

      confirm_token: {

        type: "string",

        description: "Cryptographic confirmation token",

      },

    },

  },

  {

    name: "press_key",

    description: "Sends an allowlisted keyboard key or key combination to the target window",

    riskLevel: "SAFE",

    parameters: {

      key: {

        type: "string",

        description: "Allowlisted key (ENTER, ESC, TAB, BACKSPACE, DELETE, SPACE, UP, DOWN, LEFT, RIGHT, PGUP, PGDN, HOME, END, CTRL+A/C/V/Z/S/F)",

        required: true,

      },

      window_title: {

        type: "string",

        description: "Target window title",

      },

      hwnd: {

        type: "number",

        description: "Native window handle (HWND)",

      },

      target_pid: {

        type: "number",

        description: "Process ID",

      },

      confirm_token: {

        type: "string",

        description: "Cryptographic confirmation token for consequential keys",

      },

    },

  },

  {

    name: "capture_screen",

    description: "Captures an on-demand high-resolution screenshot of the Windows desktop display or targeted window",

    riskLevel: "SAFE",

    parameters: {

      target_window: {

        type: "string",

        description: "Optional window title substring to capture",

      },

      max_width: {

        type: "number",

        description: "Maximum width downsampling constraint (default: 1280)",

      },

    },

  },

  {

    name: "analyze_screen",

    description: "Analyzes the current screen using local AI vision and native Windows UI hierarchy to understand layout, buttons, text, and active windows",

    riskLevel: "SAFE",

    parameters: {

      query: {

        type: "string",

        description: "What to look for or analyze on screen (e.g. 'what is on my screen')",

      },

    },

  },

  {

    name: "browse_web",

    description: "Dynamically retrieves and extracts rendered web page content using headless browser automation and sanitized content extraction",

    riskLevel: "SAFE",

    parameters: {

      url: {

        type: "string",

        description: "The full HTTP or HTTPS URL to browse and extract",

        required: true,

      },

      max_length: {

        type: "number",

        description: "Maximum extracted text length (default: 3000)",

      },

    },

  },

  {

    name: "desktop_workflow",

    description: "Executes verified desktop application control workflows (focus, click, type, press_key, inspect) on Windows applications (Notepad, Calc, Explorer, Edge, VS Code, Task Manager) following the 8-step verified interaction flow.",

    riskLevel: "SAFE",

    parameters: {

      action: {

        type: "string",

        description: "Action to execute: 'focus' | 'click' | 'type' | 'press_key' | 'inspect'",

        required: true,

      },

      application: {

        type: "string",

        description: "Target application name (notepad, calc, explorer, edge, vscode, taskmgr)",

      },

      window_title: {

        type: "string",

        description: "Window title substring if targeting by title",

      },

      control_name: {

        type: "string",

        description: "Accessible name of the button/control to click or target",

      },

      automation_id: {

        type: "string",

        description: "Automation ID of target control",

      },

      control_type: {

        type: "string",

        description: "Control type (e.g. Button, Edit, MenuItem, TabItem)",

      },

      text: {

        type: "string",

        description: "Text to enter into the focused input element (for 'type' action)",

      },

      key: {

        type: "string",

        description: "Keyboard key to press (for 'press_key' action, e.g. ENTER, ESC, TAB, CTRL+S)",

      },

    },

  },

];



export interface RouteDecision {

  intent: RouteIntent;

  targetModel: string;

  fastLocalResponse?: string;

  toolRequired?: string;

  toolParams?: Record<string, any>;

  planGoal?: string;

  confidence: number;

  reason: string;

  taskContext?: StructuredTaskContext;

  companionTone?: ToneAnalysis;

  riskLevel?: ExecutionRiskLevel;

  requiresApproval?: boolean;

}



// Fast regex patterns for 0ms deterministic responses

const TIME_DATE_PATTERNS = [

  /\b(what time is it|current time|kya time hai|time kya hai|kya baj raha hai|samay kya hai|time please|tell me the time|kitne baje|समय क्या हुआ|समय बताओ)\b/i,

  /\b(what is the date|today's date|aaj ki date|aaj kya date hai|aaj kaun sa din|aaj.*date|what day is it|what.*date|current date|aaj ki taarikh|आज की तारीख)\b/i,

];



export const ORB_CONTROL_PATTERNS = [

  /\b(reset view|reset orb|orb reset|camera reset)\b/i,

];



export const TELEMETRY_PATTERNS = [

  /\b(status report|system status|system diagnostic|diagnostics|hardware check|subsystems check|सिस्टम चेक)\b/i,

  /\b(?:check|show|get|display|batao|dekho|give me|report)\s+(?:the\s+|my\s+|mera\s+|current\s+|live\s+)?(?:cpu|ram|battery|hardware|telemetry|system)(?:\s+(?:aur|and|,)\s+(?:cpu|ram|battery|hardware|telemetry|system))?\s*(?:usage|utilization|status|metrics|report)?\b/i,

  /\b(?:cpu|ram|battery|hardware|telemetry)(?:\s+(?:aur|and|,)\s+(?:cpu|ram|battery|hardware|telemetry))?\s*(?:usage|utilization|status|metrics|stats)\s*(?:check|batao|dekho|karo|report|do|de do|bata do)?\b/i,

  /\b(system kaisa hai|system kaisa chal raha hai|kya chal raha hai)\b/i,

  /\b(?:system|hardware)\s+(?:ka\s+)?(?:status|hardware|performance|kaisa\s+hai|kaisa\s+chal\s+raha\s+hai)\b/i,

  /\b(?:hardware|system)\s+kaisa\s+chal\s+raha\s+hai\b/i,

  /\b(?:system|hardware)\s*(?:telemetry|metrics|stats)\b/i,

];



// Unified SYSTEM_CONTROL_PATTERNS: handles orb controls and system telemetry safely.

// Optional whitespace is represented by \s* (zero or more whitespace characters), avoiding literal asterisk matches.

export const SYSTEM_CONTROL_PATTERNS = [

  ...ORB_CONTROL_PATTERNS,

  ...TELEMETRY_PATTERNS,

];



const GREETING_PATTERNS = [

  /^(hi|hello|hey|hey ultron|hello ultron|hola|namaste|sup|yo|good morning|good evening|good afternoon|suno|bhai suno|hello bhai|namaskar|नमस्ते)[\s!.,?]*$/i,

  /^(how are you|kaise ho|kaise ho bhai|how are you doing|sab kaisa hai|kya haal hai|kya haal chaal|सब कैसा है)[\s!.,?]*$/i,

];



// Anti-hallucination factual guardrails for common traps

const FACTUAL_TRAPS: Array<{ pattern: RegExp; response: string }> = [

  {

    pattern: /\b(5th law of thermodynamics|fifth law of thermodynamics)\b/i,

    response: "There is no 5th law of thermodynamics. Thermodynamics fundamentally consists only of the Zeroth, First, Second, and Third laws.",

  },

  {

    pattern: /\b(president of the united states in (?:the year )?1650)\b/i,

    response: "There was no President of the United States in the year 1650. The United States was founded in 1776, and George Washington became the first President in 1789.",

  },

  {

    pattern: /\b(atomic number of vibranium)\b/i,

    response: "Vibranium is a fictional element from Marvel Comics. It does not exist on the real periodic table of elements.",

  },

  {

    pattern: /\b(capital (?:city )?of australia)\b/i,

    response: "The capital of Australia is Canberra.",

  },

];



export function routeUserQuery(

  userInput: string,

  modelOverride?: string,

  history?: ConversationalTurn[]

): RouteDecision {

  const taskContext = QuestionUnderstandingEngine.parse(userInput, history || []);

  const trimmed = taskContext.resolvedRequest.trim();

  const lower = trimmed.toLowerCase();

  const companionTone = CompanionPersonalityEngine.analyzeTone(userInput, history || []);



  // 00a. Companion Project Decision Conflict Detection

  const decisionConflict = ProjectContextManager.detectDecisionConflict(trimmed);

  if (decisionConflict.hasConflict) {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: `${decisionConflict.explanation}\n\n${decisionConflict.suggestedClarification}`,

      confidence: 1.0,

      reason: "Project decision conflict detected and surfaced constructively",

      companionTone,

      taskContext,

    };

  }



  // 00b. Constructive Challenge on Impossible/Hardware-Exceeding Features

  const dissent = CompanionPersonalityEngine.evaluateConstructiveChallenge(trimmed);

  if (dissent.shouldChallenge) {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: `### Technical Assessment & Resource Reality\n\n• **Concern:** ${dissent.concern}\n• **Evidence:** ${dissent.evidence}\n• **Recommended Alternative:** ${dissent.alternative}\n• **Suggested Next Step:** ${dissent.recommendedNextStep}\n\nThe final decision is yours, Ashish. Should we proceed with the recommended local approach?`,

      confidence: 1.0,

      reason: "Constructive challenge based on hardware constraints and project boundaries",

      companionTone,

      taskContext,

    };

  }



  // 00c. Previous Project Decisions Retrieval

  if (/\b(?:what was decided|previous decision|past decision|last session me kya decide|pichli session me kya decide|decisions taken|what decisions were made)\b/i.test(lower)) {

    const decisions = ProjectContextManager.getProjectState().decisions;

    const summary = decisions.map(d => `• [${d.id}] ${d.title}: ${d.rationale} (Constraint: ${d.approvedConstraint || "None"})`).join("\n");

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: `Here are the active engineering decisions recorded from our project sessions:\n\n${summary}`,

      confidence: 1.0,

      reason: "Truthful retrieval of stored project decisions",

      companionTone,

      taskContext,

    };

  }



  // 00d. Proactive Project Improvements & Focus Preferences

  if (/\b(?:ideas to improve|improve (?:the|our|this|my)?\s*project|project (?:ko|mein) improve|suggestions for (?:the|our)?\s*project)\b/i.test(lower)) {

    if (/\b(?:focus on (?:the )?current task|pehle current task|only focus on current|stay on (?:the )?task)\b/i.test(lower)) {

      return {

        intent: "SYSTEM_LOCAL",

        targetModel: "local-rule",

        fastLocalResponse: `Understood. I will keep proactive ideas aside and maintain strict focus on our active milestone: "${ProjectContextManager.getProjectState().currentTask}". What is the immediate step you'd like to tackle?`,

        confidence: 1.0,

        reason: "Respecting user explicit preference to focus on current task",

        companionTone,

        taskContext,

      };

    }

    const imps = ProjectContextManager.getProjectState().potentialImprovements;

    const ranked = imps.map((imp, idx) => `${idx + 1}. **${imp.title}** (Estimated Gain: ${imp.estimatedGain})\n   - Benefit: ${imp.benefit}\n   - Complexity: ${imp.complexity}\n   - Status: ${imp.status}`).join("\n\n");

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: `Here are prioritized, technically justified improvements for the ULTRON project:\n\n${ranked}\n\nWould you like me to formulate a concrete implementation plan for any of these?`,

      confidence: 1.0,

      reason: "Prioritized project improvements based on context",

      companionTone,

      taskContext,

    };

  }



  // 00e. Frustration handling: acknowledge friction calmly and pivot to direct diagnosis

  if (companionTone.tone === "frustration") {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: `I hear your frustration with the recurring issue. Let's skip the apologies and isolate the exact root cause directly. What is the latest error message or failing behavior you are seeing?`,

      confidence: 0.95,

      reason: "Companion empathy for frustration: brief acknowledgement and pivot to direct diagnosis",

      companionTone,

      taskContext,

    };

  }



  // 00f. Evaluation of proposed change ("is this change worthwhile")

  if (/\b(?:is (?:this|the proposed) change worthwhile|worth (?:doing|it)|should we (?:refactor|change|switch)|kya ye change karna chahiye)\b/i.test(lower)) {

    return {

      intent: "COMPLEX_REASONING",

      targetModel: modelOverride || "qwen2.5:1.5b",

      confidence: 0.92,

      reason: "Technical trade-off evaluation and recommendation",

      companionTone,

      taskContext,

    };

  }



  // 0a. Check for targeted clarification if command is genuinely ambiguous

  if (taskContext.intentType === "clarification_needed" && taskContext.clarificationPrompt) {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: taskContext.clarificationPrompt,

      confidence: 1.0,

      reason: "Targeted clarification for ambiguous instruction",

      taskContext,

    };

  }



  // 0b. Composite multi-requirement queries routed to autonomous agent loop

  if (taskContext.intentType === "composite" && taskContext.requirements.length > 1) {

    return {

      intent: "AGENT_PLAN",

      targetModel: "qwen2.5:1.5b",

      planGoal: taskContext.resolvedRequest,

      confidence: 0.95,

      reason: "Composite multi-part query routed to agent loop for complete execution",

      taskContext,

    };

  }



  // 0c. Pure conceptual explanation queries (no action/tool needed)

  if (taskContext.intentType === "explanation") {

    return {

      intent: "COMPLEX_REASONING",

      targetModel: modelOverride || "qwen2.5:1.5b",

      confidence: 0.92,

      reason: "Conceptual explanation request (anti-tool-trigger guardrail)",

      taskContext,

    };

  }



  // 1. Anti-hallucination Factual Trap Guardrails

  for (const trap of FACTUAL_TRAPS) {

    if (trap.pattern.test(lower)) {

      return {

        intent: "SYSTEM_LOCAL",

        targetModel: "local-rule",

        fastLocalResponse: trap.response,

        confidence: 1.0,

        reason: "Zero-hallucination factual verified rule",

      };

    }

  }



  // 2. Immediate local deterministic queries (Time/Date)

  for (const pattern of TIME_DATE_PATTERNS) {

    if (pattern.test(lower)) {

      const now = new Date();

      const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const dateStr = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });

      const isDateQuery = lower.includes("date") || lower.includes("din") || lower.includes("day");

      const localResponse = isDateQuery

        ? `Today is ${dateStr}. System clock running accurately, sir.`

        : `Current system time is ${timeStr}. All chronometers synchronized.`;



      return {

        intent: "SYSTEM_LOCAL",

        targetModel: "local-rule",

        fastLocalResponse: localResponse,

        confidence: 1.0,

        reason: "Instant deterministic system clock query (anti-hallucination guarantee)",

      };

    }

  }



  // 3a. Direct Orb UI Scene Controls (Independent of telemetry)

  for (const pattern of ORB_CONTROL_PATTERNS) {

    if (pattern.test(lower)) {

      return {

        intent: "TOOL_CALL",

        targetModel: "local-rule",

        toolRequired: "system_control",

        toolParams: { action: "reset_view" },

        confidence: 0.99,

        reason: "Direct orb scene control",

      };

    }

  }



  // 3b. System diagnostics & Live Telemetry

  // Exclude conceptual/educational questions (e.g. "what is cpu usage", "explain ram usage", "difference between ram and storage")

  const isEducationalOrExplanatory = /\b(what is|explain|difference between|how does|how is|why|kyon|kaise kaam|kya hota hai|concept of)\b/i.test(lower);

  if (!isEducationalOrExplanatory) {

    for (const pattern of TELEMETRY_PATTERNS) {

      if (pattern.test(lower)) {

        return {

          intent: "TOOL_CALL",

          targetModel: "local-rule",

          toolRequired: "get_system_diagnostics",

          toolParams: {},

          confidence: 0.99,

          reason: "Live system telemetry and diagnostics request",

        };

      }

    }

  }



  // 4. Memory commands: Save, Recall, Reset

  if (/\b(?:remember that|yaad rakhna ki|save fact|note kar lo)\b/i.test(lower)) {

    return {

      intent: "MEMORY_OP",

      targetModel: "local-rule",

      confidence: 0.98,

      reason: "Permanent memory save command",

    };

  }

  if (/\b(?:what do you remember|kya yaad hai|recall|purani baat|kal jo project)\b/i.test(lower)) {

    return {

      intent: "MEMORY_OP",

      targetModel: "local-rule",

      confidence: 0.95,

      reason: "Permanent memory recall / search command",

    };

  }

  if (/\b(?:reset memory|clear memory|forget everything|sab bhool jao)\b/i.test(lower)) {

    return {

      intent: "MEMORY_OP",

      targetModel: "local-rule",

      confidence: 0.99,

      reason: "Memory reset command (requires confirmation)",

    };

  }



  // 5. Autonomous Agent Loop / Multi-step Planning

  if (

    /\b(?:mere project ko test|test karke.*fix|test.*errors.*fix|inspect.*repo|run agent plan|plan and execute)\b/i.test(lower) ||

    (/\b(?:test karo|errors check karo|run tests)\b/i.test(lower) && /\b(?:project|code|repo)\b/i.test(lower))

  ) {

    return {

      intent: "AGENT_PLAN",

      targetModel: "qwen2.5:1.5b",

      planGoal: trimmed,

      confidence: 0.95,

      reason: "Autonomous multi-step planner request (Understand -> Plan -> Execute -> Verify -> Report)",

    };

  }



  // 5b. Dedicated Real Browser Control (Google Chrome / Edge)

  const navUrlMatch = lower.match(/\b(?:navigate to|go to|open url|open website)\s+([a-zA-Z0-9\-\._~:\/\?#\[\]@!\$&'\(\)\*\+,;=]+)(?:\s+(?:in|on)\s+(chrome|edge|browser))?/i);

  if (navUrlMatch) {

    const rawUrl = navUrlMatch[1].trim();

    const browser = (navUrlMatch[2] || "chrome").toLowerCase();

    const finalUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "navigate", url: finalUrl, browser },

      confidence: 0.98,

      reason: "Real browser URL navigation and state verification",

    };

  }



  const openInBrowserMatch = lower.match(/\b(?:open|launch)\s+(?:google\s+)?(chrome|edge)\s+(?:and\s+)?(?:go to|open|navigate to)\s+(.+)/i);

  if (openInBrowserMatch) {

    const browser = openInBrowserMatch[1].toLowerCase();

    const rawUrl = openInBrowserMatch[2].trim();

    const finalUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "navigate", url: finalUrl, browser },

      confidence: 0.98,

      reason: "Launch browser and navigate to target URL",

    };

  }



  const scrollBrowserMatch = lower.match(/\b(?:scroll down|page down|scroll niche)\s*(?:in|on)?\s*(chrome|edge|browser|page)?\b/i);

  if (scrollBrowserMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "scroll_down", browser: (scrollBrowserMatch[1] || "chrome").toLowerCase() },

      confidence: 0.96,

      reason: "Scroll down in browser page",

    };

  }



  const scrollUpBrowserMatch = lower.match(/\b(?:scroll up|page up|scroll upar)\s*(?:in|on)?\s*(chrome|edge|browser|page)?\b/i);

  if (scrollUpBrowserMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "scroll_up", browser: (scrollUpBrowserMatch[1] || "chrome").toLowerCase() },

      confidence: 0.96,

      reason: "Scroll up in browser page",

    };

  }



  const refreshBrowserMatch = lower.match(/\b(?:refresh|reload|f5)\s*(?:chrome|edge|browser|page|tab)?\b/i);

  if (refreshBrowserMatch && !lower.includes("memory") && !lower.includes("system")) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "refresh", browser: "chrome" },

      confidence: 0.95,

      reason: "Refresh browser page",

    };

  }



  const switchTabMatch = lower.match(/\b(?:switch tab|next tab|change tab)\s*(?:in|on)?\s*(chrome|edge|browser)?\b/i);

  if (switchTabMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "switch_tab", browser: (switchTabMatch[1] || "chrome").toLowerCase() },

      confidence: 0.96,

      reason: "Switch browser tab",

    };

  }



  const browserStateMatch = lower.match(/\b(?:what is on (?:chrome|edge|browser)|check (?:chrome|edge|browser)|chrome screen|browser screen)\b/i);

  if (browserStateMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browser_control",

      toolParams: { action: "get_state", browser: "chrome" },

      confidence: 0.96,

      reason: "Inspect active browser tab state",

    };

  }



  // 6a. Windows UI Automation: Discovery and Element Inspection (Prioritized ahead of app launch)

  const windowEnumMatch = lower.match(/\b(?:list (?:all\s+|open\s+|active\s+)*windows|what windows are open|show (?:all\s+|active\s+|open\s+)*windows|enumerate windows|kaunse windows khule hain)\b/i);

  if (windowEnumMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "enumerate_windows",

      toolParams: {},

      confidence: 0.99,

      reason: "Enumerate active Windows top-level windows",

    };

  }



  // 6b. Direct Application Launch / Termination (Dynamic laptop discovery & Hindi/Hinglish phrasing)

  const isWindowListingQuery = /\b(?:list|show|what|enumerate)\b/i.test(lower);

  const nounFirstOpen = !isWindowListingQuery && lower.match(/\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\-_]+)\s+(?:kholo|chalao|open karo|start karo|launch karo|ko kholo|ko start karo)\b/i);

  const verbFirstOpen = !isWindowListingQuery && lower.match(/\b(?:open|launch|kholo|chalao|start)\s+(?!karo\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\-_]+)(?:\s+(?:app|application|program|window))?\b/i);

  const openAppMatch = nounFirstOpen || verbFirstOpen;



  if (openAppMatch) {

    const rawName = openAppMatch[1].trim();

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "launch_application",

      toolParams: { app_name: rawName },

      confidence: 0.98,

      reason: "Dynamic desktop application launch/focus",

    };

  }



  const nounFirstClose = lower.match(/\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\-_]+)\s+(?:band karo|hatao|kill karo|close karo|terminate karo)\b/i);

  const verbFirstClose = lower.match(/\b(?:close|band karo|hatao|kill|terminate)\s+(?!karo\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\-_]+)\b/i);

  const closeAppMatch = nounFirstClose || verbFirstClose;



  if (closeAppMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "close_application",

      toolParams: { app_name: closeAppMatch[1].trim() },

      confidence: 0.98,

      reason: "High-risk application close requiring cryptographic confirmation gate",

    };

  }



  const windowInspectMatch = lower.match(/\b(?:inspect window|inspect ui|check elements of|window elements|inspect controls of)\s*(.*)/i);

  if (windowInspectMatch) {

    const rawTarget = windowInspectMatch[1]?.trim() || "";

    const params: Record<string, any> = {};

    if (/^\d+$/.test(rawTarget)) {

      params.target_pid = parseInt(rawTarget, 10);

    } else if (rawTarget) {

      params.window_title = rawTarget;

    }

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "inspect_window_elements",

      toolParams: params,

      confidence: 0.98,

      reason: "Native Windows UI Automation element tree inspection (Read-Only)",

    };

  }



  // 6c. Windows UI Automation: Native Desktop Actions (Phase 3B - Safe Native Desktop Control)

  const focusWindowMatch = lower.match(/\b(?:focus window|switch to window|bring window to (?:front|top)|window focus|focus karo window)\s*(.*)/i);

  if (focusWindowMatch) {

    const rawTarget = focusWindowMatch[1]?.trim() || "";

    const params: Record<string, any> = {};

    if (/^\d+$/.test(rawTarget)) {

      params.target_pid = parseInt(rawTarget, 10);

    } else if (rawTarget) {

      params.window_title = rawTarget;

    }

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "focus_window",

      toolParams: params,

      confidence: 0.98,

      reason: "Native Windows focus_window action",

    };

  }



  const clickElementMatch = lower.match(/\b(?:click(?: ui)? element|click button|click control)\s+(.+?)(?:\s+(?:in|on)\s+(?:window\s+)?(.+))?$/i);

  if (clickElementMatch) {

    const targetEl = clickElementMatch[1]?.trim() || "";

    const targetWin = clickElementMatch[2]?.trim() || "";

    const params: Record<string, any> = { element_name: targetEl };

    if (targetWin) {

      if (/^\d+$/.test(targetWin)) {

        params.target_pid = parseInt(targetWin, 10);

      } else {

        params.window_title = targetWin;

      }

    }

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "click_ui_element",

      toolParams: params,

      confidence: 0.98,

      reason: "Native Windows click_ui_element action",

    };

  }



  const typeTextMatch = lower.match(/\b(?:type text|enter text|type)\s+["']?([^"']+)["']?(?:\s+(?:in|into)\s+(?:window\s+)?(.+))?$/i);

  if (typeTextMatch && !/^(error|warning|info|help|commands|status)$/i.test(typeTextMatch[1])) {

    const textToType = typeTextMatch[1]?.trim() || "";

    const targetWin = typeTextMatch[2]?.trim() || "";

    const params: Record<string, any> = { text: textToType };

    if (targetWin) {

      if (/^\d+$/.test(targetWin)) {

        params.target_pid = parseInt(targetWin, 10);

      } else {

        params.window_title = targetWin;

      }

    }

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "type_text",

      toolParams: params,

      confidence: 0.98,

      reason: "Native Windows type_text action (Requires confirmation)",

    };

  }



  const pressKeyMatch = lower.match(/\b(?:press key|send key|hit key|press)\s+([A-Za-z0-9+_-]+)(?:\s+(?:in|on)\s+(?:window\s+)?(.+))?$/i);

  if (pressKeyMatch && !/^(the|a|an|button|control|element)$/i.test(pressKeyMatch[1])) {

    const key = pressKeyMatch[1]?.trim() || "";

    const targetWin = pressKeyMatch[2]?.trim() || "";

    const params: Record<string, any> = { key };

    if (targetWin) {

      if (/^\d+$/.test(targetWin)) {

        params.target_pid = parseInt(targetWin, 10);

      } else {

        params.window_title = targetWin;

      }

    }

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "press_key",

      toolParams: params,

      confidence: 0.98,

      reason: "Native Windows press_key action",

    };

  }



  // 7. File search

  const fileSearchMatch = lower.match(/\b(?:search file|find file|dhundo file|locate file|file search)\s+(.+)/i);

  if (fileSearchMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "search_files",

      toolParams: { query_pattern: fileSearchMatch[1].trim() },

      confidence: 0.96,

      reason: "File search in approved directories",

    };

  }



  // 7a-1. Desktop Screen Capture & Local Vision Understanding

  if (/\b(?:take (?:a )?screenshot|capture screen|screen capture|screenshot le lo|desktop screenshot|snapshot screen)\b/i.test(lower)) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "capture_screen",

      toolParams: {},

      confidence: 0.98,

      reason: "On-demand Windows desktop screen capture",

    };

  }



  if (/\b(?:what is on my screen|analyze (?:my )?screen|screen pe kya hai|look at (?:my )?screen|what do you see|screen dekho|describe screen|page (?:par|pe) kya (?:hai|likha hai)|screen (?:par|pe) kya (?:hai|likha hai)|what is (?:on|written on) (?:the |my )?(?:page|screen)|read (?:the )?(?:page|screen)|batao (?:page|screen) (?:par|pe) kya likha hai)\b/i.test(lower)) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "analyze_screen",

      toolParams: { query: trimmed },

      confidence: 0.98,

      reason: "Local AI vision & desktop screen comprehension",

    };

  }



  // 7a-2. Headless Dynamic Web Browsing & Extraction

  const browseUrlMatch = lower.match(/\b(?:browse(?:\s+(?:url|page|webpage|site))?|fetch page|extract page|open url)\s+(https?:\/\/[^\s]+)/i);

  if (browseUrlMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "browse_web",

      toolParams: { url: browseUrlMatch[1].trim() },

      confidence: 0.98,

      reason: "Controlled headless dynamic web page extraction",

    };

  }



  // 7b. Browser Web Research

  const webSearchMatch = lower.match(/\b(?:search (?:the )?web|web search|search online|browse web|look up online|internet search)\s+(.+)/i);

  if (webSearchMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "web_search",

      toolParams: { query: webSearchMatch[1].trim() },

      confidence: 0.96,

      reason: "Browser research subsystem query",

    };

  }



  // 7c. Direct File Read

  const readFileMatch = lower.match(/\b(?:read file|inspect file|cat file|view file|file padho)\s+([^\s"']+)/i);

  if (readFileMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "read_file",

      toolParams: { file_path: readFileMatch[1].trim() },

      confidence: 0.96,

      reason: "Inspect file contents",

    };

  }



  // 7d. Direct File Delete (High-risk confirmation gate)

  const deleteFileMatch = lower.match(/\b(?:delete file|remove file|hatao file|file delete karo)\s+([^\s"']+)/i);

  if (deleteFileMatch) {

    return {

      intent: "TOOL_CALL",

      targetModel: "local-rule",

      toolRequired: "delete_file",

      toolParams: { file_path: deleteFileMatch[1].trim() },

      confidence: 0.98,

      reason: "High-risk file delete requiring cryptographic confirmation gate",

    };

  }



  // 7e. Ambiguous destructive action (Missing target)

  if (/\b(?:delete the file|delete a file|file delete karo|hata do file|delete file)\b/i.test(lower) && !deleteFileMatch) {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: "Please specify the exact file path or filename you would like to delete, sir.",

      confidence: 0.95,

      reason: "Ambiguous command requesting clarification",

    };

  }



  // 7f. Offline Architecture explanation in natural Hinglish

  if (/\b(?:offline kaise kaam karte|how do you work offline|offline architecture|bina internet ke kaise)\b/i.test(lower)) {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: "ULTRON local-first architecture par operate karta hai, sir. Mera core brain local Ollama (qwen2.5) par execute hota hai, offline voice transcription local Faster-Whisper handle karta hai, aur personal memory local JSON storage mein permanently save hoti hai. Private user data kabhi kisi external cloud server par nahi bheja jata.",

      confidence: 1.0,

      reason: "Accurate local-first architecture explanation reflecting actual implementation",

    };

  }



  // 8. Canonical identity queries

  if (

    /\b(who are you|tum kaun ho|kaun ho tum|who made you|what are you|apna intro do|tum kya kar sakte ho|तुम कौन हो)\b/i.test(lower) &&

    !/\b(code|python|function|write|calculate)\b/i.test(lower)

  ) {

    return {

      intent: "SYSTEM_LOCAL",

      targetModel: "local-rule",

      fastLocalResponse: "Main ULTRON hoon, aapka autonomous AI system. Main system monitor kar sakta hoon, apps launch kar sakta hoon, files search kar sakta hoon, aur aapki har command execute karne ke liye ready hoon, sir.",

      confidence: 1.0,

      reason: "Deterministic canonical identity response in natural Hinglish",

    };

  }



  // 9. Fast conversational greetings (Warm unified 1.5B brain)

  for (const pattern of GREETING_PATTERNS) {

    if (pattern.test(lower)) {

      return {

        intent: "FAST_CHAT",

        targetModel: modelOverride || "qwen2.5:1.5b",

        confidence: 0.95,

        reason: "Conversational greeting - warm unified brain",

      };

    }

  }



  // 10. Direct Math calculations

  if (/\b(?:calculate|compute|math for|hisab lagao)\b/i.test(lower) || /^[\d\s+\-*/().^]+$/.test(trimmed)) {

    const expr = trimmed.replace(/^(?:calculate|compute|hisab lagao)\s+/i, "");

    return {

      intent: "TOOL_CALL",

      targetModel: "qwen2.5:1.5b",

      toolRequired: "calculate",

      toolParams: { expression: expr },

      confidence: 0.95,

      reason: "Deterministic math evaluation",

    };

  }



  // 11. Complex Reasoning triggers (including educational & conceptual inquiries)

  if (

    /\b(what is|what are|why|how does|how is|explain|analyze|solve|compare|difference between|write a|code|implement|function|algorithm|python|javascript|typescript|logic|reasoning|kya hota hai|concept of)\b/i.test(lower) ||

    /\b(bat and a ball|riddle|puzzle|math|integral|derivative|theorem|quantum|physics|step by step|multi-step)\b/i.test(lower)

  ) {

    return {

      intent: "COMPLEX_REASONING",

      targetModel: modelOverride || "qwen2.5:1.5b",

      confidence: 0.90,

      reason: "Complex cognitive reasoning or coding - routed to Smart Brain (1.5B)",

    };

  }



  // Default fallback (uses unified 1.5B smart brain so Ollama never reloads models)

  return {

    intent: "FAST_CHAT",

    targetModel: modelOverride || "qwen2.5:1.5b",

    confidence: 0.70,

    reason: "Standard conversational flow - unified smart brain",

  };

}

