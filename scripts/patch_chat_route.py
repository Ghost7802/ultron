path = "app/api/chat/route.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

target = """import { ultronPlanner } from "@/lib/ultronPlanner";
import { ultronAgentEngine } from "@/lib/ultronAgentEngine";"""

replacement = """import { ultronPlanner } from "@/lib/ultronPlanner";
import { ultronAgentEngine } from "@/lib/ultronAgentEngine";
import { CompanionPersonalityEngine } from "@/lib/companionPersonality";
import { ProjectContextManager } from "@/lib/projectContext";
import { ProjectMemoryAdapter } from "@/lib/projectMemoryAdapter";"""

code_norm = code.replace("\r\n", "\n")
target_norm = target.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

if target_norm in code_norm:
    code_norm = code_norm.replace(target_norm, replacement_norm, 1)
    print("Imports replaced.")
else:
    print("Imports target not found!")

target_prompt = """  const baseIdentity =
    "You are ULTRON, the intelligent personal AI assistant created by Ashish. You run 100% locally on this Windows machine.\\n" +
    "You have direct control over this machine, system diagnostics, Windows applications, and the holographic UI.\\n" +
    "All conversations, memory, and personal preferences remain strictly private and local.\\n" +
    langGuidance + "\\n" +
    "Your identity is strictly ULTRON. Understand the user's intent deeply. Answer directly, accurately, and naturally.\\n" +
    constraintBlock;"""

replacement_prompt = """  const companionBlock = decision.companionTone
    ? CompanionPersonalityEngine.getCompanionPromptBlock(decision.companionTone, lang)
    : "";
  const projectSummary = `\\n[ACTIVE PROJECT CONTEXT]:\\n${ProjectContextManager.getContextSummary()}\\n`;

  const baseIdentity =
    "You are ULTRON, the intelligent personal AI assistant created by Ashish. You run 100% locally on this Windows machine.\\n" +
    "You have direct control over this machine, system diagnostics, Windows applications, and the holographic UI.\\n" +
    "All conversations, memory, and personal preferences remain strictly private and local.\\n" +
    langGuidance + "\\n" +
    companionBlock + "\\n" +
    projectSummary + "\\n" +
    "Your identity is strictly ULTRON. Understand the user's intent deeply. Answer directly, accurately, and naturally.\\n" +
    constraintBlock;"""

target_prompt_norm = target_prompt.replace("\r\n", "\n")
replacement_prompt_norm = replacement_prompt.replace("\r\n", "\n")

if target_prompt_norm in code_norm:
    code_norm = code_norm.replace(target_prompt_norm, replacement_prompt_norm, 1)
    print("Prompt replaced.")
else:
    print("Prompt target not found!")

with open(path, "w", encoding="utf-8") as f:
    f.write(code_norm)
print("SUCCESS")

