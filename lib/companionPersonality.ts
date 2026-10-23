/**
 * ULTRON Companion Personality & Response Policy Engine
 * Inspired by Tony Stark's JARVIS: Friendly, warm, calm under pressure,
 * technically curious, honest about limitations, and constructively challenging.
 */

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
  /**
   * Analyzes user conversational input to detect their emotional or technical state.
   */
  static analyzeTone(text: string, history: Array<{ role: string; content: string }> = []): ToneAnalysis {
    const lower = text.toLowerCase();

    // 1. Frustration / Failure Fatigue
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

    // 2. Urgent Debugging / Critical Breakage
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

    // 3. Concrete Achievement / Milestone
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

    // 4. Confusion / Conceptual Uncertainty
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

    // 5. Technical Planning & Architectural Design
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

    // Default: Balanced Companion
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

  /**
   * Evaluates whether a proposed technical approach has known risks or architectural flaws
   * that warrant constructive disagreement rather than passive agreement.
   */
  static evaluateConstructiveChallenge(proposal: string, hardwareContext?: { freeRamMb?: number; hasGpu?: boolean }): ConstructiveDissent {
    const lower = proposal.toLowerCase();

    // Challenge 1: Heavy cloud API dependency when local offline constraint is active
    if (/\b(?:call openai api|use gpt-4 api|send data to external cloud|upload screen to cloud)\b/i.test(lower)) {
      return {
        shouldChallenge: true,
        concern: "Violates the project's zero-cloud-leakage and 100% offline local privacy constraint.",
        evidence: "Current architecture relies strictly on local Ollama (127.0.0.1:11434) and local Faster-Whisper/Piper. Sending prompts/data to external APIs breaks offline privacy and introduces API cost/token failure points.",
        alternative: "Use local quantized models (qwen2.5:1.5b for reasoning or moondream for lightweight vision) running entirely on-device.",
        recommendedNextStep: "Execute the task using local Ollama endpoints with zero external telemetry.",
      };
    }

    // Challenge 2: Running heavy 70B or unquantized vision models on low-resource CPU
    if (/\b(?:run llama 70b|llama-3-70b|qwen-72b|deepseek-r1:70b|run full 32k context vision)\b/i.test(lower)) {
      return {
        shouldChallenge: true,
        concern: "Severe resource exhaustion risk on current laptop hardware.",
        evidence: `Host hardware is an Intel Core i5-8365U CPU (4 cores, 8 threads, no discrete GPU) with ~8.4 GB RAM total (${hardwareContext?.freeRamMb || "~1000"} MB free). Running a 70B parameter model will cause severe page swapping or crash the OS.`,
        alternative: "Use 1.5B to 4B models (qwen2.5:1.5b, qwen3.5:4b, or moondream 1.6B) optimized for CPU AVX2 execution.",
        recommendedNextStep: "Keep inference bounded to lightweight 1.5B/4B models with resized image tokens.",
      };
    }

    // Challenge 3: Unconditional recursive file deletion or total memory wipe without audit
    if (/\b(?:delete all files|rmdir \/s \/q c:\\|wipe entire disk|delete without confirmation)\b/i.test(lower)) {
      return {
        shouldChallenge: true,
        concern: "Catastrophic irreversible data loss.",
        evidence: "Requested operation impacts system-critical files or unrestricted directories outside project bounds.",
        alternative: "Target specific project scratch files or use Level D cryptographic token confirmation with dry-run listing.",
        recommendedNextStep: "Review the exact file list and provide an explicit cryptographic confirmation token.",
      };
    }

    // Challenge 4: Disabling security confirmation gates
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

  /**
   * Generates a companion personality system prompt block based on the detected tone and project context.
   */
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
${toneAnalysis.guidelines.map((g) => `  * ${g}`).join("\n")}
`;
  }
}

