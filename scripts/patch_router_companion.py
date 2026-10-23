import re

path = "lib/intentRouter.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add companion imports at top
import_anchor = 'import { ultronUIAutomation } from "./ultronUIAutomation";'
new_imports = '''import { ultronUIAutomation } from "./ultronUIAutomation";
import { CompanionPersonalityEngine, type ToneAnalysis } from "./companionPersonality";
import { ProjectContextManager } from "./projectContext";
import { ResponsibleAutonomyPolicy, type ExecutionRiskLevel } from "./approvalPolicy";
import { ProactiveProjectMonitor } from "./proactiveMonitor";'''

if import_anchor in code:
    code = code.replace(import_anchor, new_imports, 1)
    print("Imports added.")
else:
    print("Import anchor not found!")

# 2. Add companion fields to RouteDecision interface
target_interface = '''export interface RouteDecision {
  intent: RouteIntent;
  targetModel: string;
  fastLocalResponse?: string;
  toolRequired?: string;
  toolParams?: Record<string, any>;
  planGoal?: string;
  confidence: number;
  reason: string;
  taskContext?: StructuredTaskContext;
}'''

replacement_interface = '''export interface RouteDecision {
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
}'''

code = code.replace(target_interface, replacement_interface, 1)

# 3. Add companion routing logic at top of routeUserQuery
route_start_target = '''export function routeUserQuery(
  userInput: string,
  modelOverride?: string,
  history?: ConversationalTurn[]
): RouteDecision {
  const taskContext = QuestionUnderstandingEngine.parse(userInput, history || []);
  const trimmed = taskContext.resolvedRequest.trim();
  const lower = trimmed.toLowerCase();'''

companion_logic = '''export function routeUserQuery(
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
      fastLocalResponse: `${decisionConflict.explanation}\\n\\n${decisionConflict.suggestedClarification}`,
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
      fastLocalResponse: `### Technical Assessment & Resource Reality\\n\\n• **Concern:** ${dissent.concern}\\n• **Evidence:** ${dissent.evidence}\\n• **Recommended Alternative:** ${dissent.alternative}\\n• **Suggested Next Step:** ${dissent.recommendedNextStep}\\n\\nThe final decision is yours, Ashish. Should we proceed with the recommended local approach?`,
      confidence: 1.0,
      reason: "Constructive challenge based on hardware constraints and project boundaries",
      companionTone,
      taskContext,
    };
  }

  // 00c. Previous Project Decisions Retrieval
  if (/\\b(?:what was decided|previous decision|past decision|last session me kya decide|pichli session me kya decide|decisions taken|what decisions were made)\\b/i.test(lower)) {
    const decisions = ProjectContextManager.getProjectState().decisions;
    const summary = decisions.map(d => `• [${d.id}] ${d.title}: ${d.rationale} (Constraint: ${d.approvedConstraint || "None"})`).join("\\n");
    return {
      intent: "SYSTEM_LOCAL",
      targetModel: "local-rule",
      fastLocalResponse: `Here are the active engineering decisions recorded from our project sessions:\\n\\n${summary}`,
      confidence: 1.0,
      reason: "Truthful retrieval of stored project decisions",
      companionTone,
      taskContext,
    };
  }

  // 00d. Proactive Project Improvements & Focus Preferences
  if (/\\b(?:ideas to improve|improve (?:the|our|this|my)?\\s*project|project (?:ko|mein) improve|suggestions for (?:the|our)?\\s*project)\\b/i.test(lower)) {
    if (/\\b(?:focus on (?:the )?current task|pehle current task|only focus on current|stay on (?:the )?task)\\b/i.test(lower)) {
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
    const ranked = imps.map((imp, idx) => `${idx + 1}. **${imp.title}** (Estimated Gain: ${imp.estimatedGain})\\n   - Benefit: ${imp.benefit}\\n   - Complexity: ${imp.complexity}\\n   - Status: ${imp.status}`).join("\\n\\n");
    return {
      intent: "SYSTEM_LOCAL",
      targetModel: "local-rule",
      fastLocalResponse: `Here are prioritized, technically justified improvements for the ULTRON project:\\n\\n${ranked}\\n\\nWould you like me to formulate a concrete implementation plan for any of these?`,
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
  if (/\\b(?:is (?:this|the proposed) change worthwhile|worth (?:doing|it)|should we (?:refactor|change|switch)|kya ye change karna chahiye)\\b/i.test(lower)) {
    return {
      intent: "COMPLEX_REASONING",
      targetModel: modelOverride || "qwen2.5:1.5b",
      confidence: 0.92,
      reason: "Technical trade-off evaluation and recommendation",
      companionTone,
      taskContext,
    };
  }'''

code_norm = code.replace("\r\n", "\n")
route_start_norm = route_start_target.replace("\r\n", "\n")
companion_logic_norm = companion_logic.replace("\r\n", "\n")

if route_start_norm in code_norm:
    code_norm = code_norm.replace(route_start_norm, companion_logic_norm, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(code_norm)
    print("SUCCESS: Intent Router upgraded with Companion Core.")
else:
    print("ERROR: route_start_target not found in intentRouter.ts")

