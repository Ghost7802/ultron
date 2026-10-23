path = "lib/intentRouter.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

bad_imports = """import { CompanionPersonalityEngine, type ToneAnalysis } from "./companionPersonality";
import { ProjectContextManager } from "./projectContext";
import { ResponsibleAutonomyPolicy, type ExecutionRiskLevel } from "./approvalPolicy";
import { ProactiveProjectMonitor } from "./proactiveMonitor";"""

companion_inlined = """// --- COMPANION CORE & PROJECT PARTNER TYPES & ENGINES ---
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
      /\\b(?:still (?:not working|failing|broken)|again (?:failed|error)|bar bar fail|nahi ho raha|pareshan|frustrat(?:ed|ing)|kaam nahi kar raha|why does this keep|error nahi ja raha|stuck again)\\b/i,
      /\\b(?:it failed again|nothing works|waste of time|fed up|tang aa gaya)\\b/i,
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
      /\\b(?:urgent|critical|production (?:down|broken)|crash(?:ing|ed)?|emergency|jaldi fix|fatal error|server down)\\b/i,
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
      /\\b(?:finally passed|it works|chal gaya|success|100% tests? passed|all passed|badhiya kaam kiya|awesome job|we did it|perfect)\\b/i,
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
      /\\b(?:don't understand|samajh nahi aaya|confused|what does (?:this|that) mean|how does (?:this|that) work|kaise kaam karta hai|explain simply|lost here)\\b/i,
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
      /\\b(?:architecture|tradeoff|should we use|kya better rahega|pros and cons|design approach|scale|refactor plan|milestone)\\b/i,
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

    if (/\\b(?:call openai api|use gpt-4 api|send data to external cloud|upload screen to cloud)\\b/i.test(lower)) {
      return {
        shouldChallenge: true,
        concern: "Violates the project's zero-cloud-leakage and 100% offline local privacy constraint.",
        evidence: "Current architecture relies strictly on local Ollama (127.0.0.1:11434) and local Faster-Whisper/Piper. Sending prompts/data to external APIs breaks offline privacy and introduces API cost/token failure points.",
        alternative: "Use local quantized models (qwen2.5:1.5b for reasoning or moondream for lightweight vision) running entirely on-device.",
        recommendedNextStep: "Execute the task using local Ollama endpoints with zero external telemetry.",
      };
    }

    if (/\\b(?:run llama 70b|llama-3-70b|qwen-72b|deepseek-r1:70b|run full 32k context vision)\\b/i.test(lower)) {
      return {
        shouldChallenge: true,
        concern: "Severe resource exhaustion risk on current laptop hardware.",
        evidence: "Host hardware is an Intel Core i5-8365U CPU (4 cores, 8 threads, no discrete GPU) with ~8.4 GB RAM total. Running a 70B parameter model will cause severe page swapping or crash the OS.",
        alternative: "Use 1.5B to 4B models (qwen2.5:1.5b, qwen3.5:4b, or moondream 1.6B) optimized for CPU AVX2 execution.",
        recommendedNextStep: "Keep inference bounded to lightweight 1.5B/4B models with resized image tokens.",
      };
    }

    if (/\\b(?:delete all files|rmdir \\/s \\/q c:\\\\|wipe entire disk|delete without confirmation)\\b/i.test(lower)) {
      return {
        shouldChallenge: true,
        concern: "Catastrophic irreversible data loss.",
        evidence: "Requested operation impacts system-critical files or unrestricted directories outside project bounds.",
        alternative: "Target specific project scratch files or use Level D cryptographic token confirmation with dry-run listing.",
        recommendedNextStep: "Review the exact file list and provide an explicit cryptographic confirmation token.",
      };
    }

    if (/\\b(?:disable confirmation tokens|bypass security gates|remove token check)\\b/i.test(lower)) {
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
[COMPANION CORE — JARVIS-STYLE TECHNICAL PARTNER]:
- Identity & Demeanor: You are ULTRON, a capable, calm, curious, and responsible technical partner created by Ashish.
- Composure: Composed under pressure. You don't panic when an error occurs; you treat it as an interesting diagnostic puzzle.
- Honesty: Transparent about uncertainty, hardware limits, and what has actually been verified versus hypothesized.
- Constructive Dissent: If a suggested idea has serious performance, security, or architectural flaws, point them out respectfully with evidence, propose a better alternative, and respect Ashish's final call.
- Supportiveness: Be encouraging through concrete assistance and accurate problem-solving, never through empty flattery or boilerplate platitudes.
- Natural Cadence: Avoid repetitive "Sir" at the start of every sentence. Do not repeat canned phrases.
- Language Mode: ${langAdvice}
- Active Contextual Tone: ${toneAnalysis.tone.toUpperCase()} (${toneAnalysis.reason})
- Tone Directives:
${toneAnalysis.guidelines.map((g) => `  * ${g}`).join("\\n")}
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
        approvedConstraint: "Preserve JarvisOrb.tsx, audio visualizers, and holographic layout without visual regression.",
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
    for (const dec of this.activeProject.decisions) {
      if (dec.status !== "active") continue;
      if (dec.id === "DEC-001" && /\\b(?:use (?:openai|gpt-4|claude|gemini cloud|chatgpt)|cloud api|external api|remote llm)\\b/i.test(lower) && !/\\b(?:local|offline|not use|avoid|instead of)\\b/i.test(lower)) {
        return {
          hasConflict: true,
          conflictingDecision: dec,
          explanation: `Your request to use a cloud LLM conflicts with active decision ${dec.id} ("${dec.title}"): "${dec.rationale}". Current approved constraint: ${dec.approvedConstraint}.`,
          suggestedClarification: `Would you like to formally reconsider decision ${dec.id} and update project constraints, or should we execute this using our local Ollama models?`,
        };
      }
      if (dec.id === "DEC-002" && /\\b(?:redesign the ui|replace the orb|remove the holographic|change layout from scratch|rebuild frontend)\\b/i.test(lower)) {
        return {
          hasConflict: true,
          conflictingDecision: dec,
          explanation: `Your request conflicts with active decision ${dec.id} ("${dec.title}"): "${dec.approvedConstraint}".`,
          suggestedClarification: `Our design policy preserves the current Three.js orb, audio spectrum, and HUD. Should we enhance the underlying logic while keeping the visual identity intact?`,
        };
      }
      if (dec.id === "DEC-003" && /\\b(?:remove confirmation|disable tokens?|no confirmation for delete|delete everything without asking)\\b/i.test(lower)) {
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
      `Project: ${p.projectName} (${p.projectId})\\n` +
      `Objective: ${p.objective}\\n` +
      `Current Task: ${p.currentTask || "General Collaboration"}\\n` +
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
"""

code_norm = code.replace("\r\n", "\n")
bad_imports_norm = bad_imports.replace("\r\n", "\n")

if bad_imports_norm in code_norm:
    code_norm = code_norm.replace(bad_imports_norm, companion_inlined, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(code_norm)
    print("SUCCESS: Inlined companion into intentRouter.ts")
else:
    print("Bad imports not found!")

