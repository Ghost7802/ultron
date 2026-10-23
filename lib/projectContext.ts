/**



 * ULTRON Project Context & Multi-Scope Policy Manager (Module 2 & 5)



 * 



 * STRICT SCOPE SEPARATION:



 * 1. QuantumX (Scope: "QuantumX")



 *    - The ONLY permitted user-project namespace in persistent memory.



 *    - Confirmed Strategic Direction: Model-agnostic AI orchestration platform.



 *    - May coordinate hosted and local models according to confirmed requirements.



 *    - All unverified architecture details, providers, and milestones are strictly UNCONFIRMED.



 * 



 * 2. ULTRON Host Runtime (Scope: "ULTRON_INTERNAL")



 *    - Internal operational context, hardware diagnostics, desktop automation, and 3D orb HUD.



 *    - Not an additional user project.



 *    - Governed by ULTRON-specific operational decisions (ULTRON-DEC-001 to ULTRON-DEC-004).



 */







import { ultronMemory } from "./ultronMemory";



import { QuantumXMemoryEngine, type QuantumXMemoryRecord } from "./quantumxMemory";







export type DecisionScope = "ULTRON_INTERNAL" | "QuantumX";







export interface ProjectDecision {



  id: string;



  scope: DecisionScope;



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



export interface DecisionConflictResult {



  hasConflict: boolean;



  conflictingDecision?: ProjectDecision;



  explanation?: string;



  suggestedClarification?: string;



}







export class ProjectContextManager {



  // --- ULTRON INTERNAL OPERATIONAL CONTEXT (Not a user project) ---



  private static ultronInternalDecisions: ProjectDecision[] = [



    {



      id: "ULTRON-DEC-001",



      scope: "ULTRON_INTERNAL",



      title: "ULTRON Host Runtime Strictly Local-First & Offline Privacy",



      rationale: "User privacy on this Windows laptop is sacred; avoid cloud API costs, subscription barriers, and network latency/outages for ULTRON's own host assistant operations.",



      approvedConstraint: "ULTRON host assistant does not depend on cloud LLM APIs. Local Ollama (127.0.0.1:11434) and local Faster-Whisper/Piper are used for assistant operations.",



      timestamp: "2026-10-21T10:00:00Z",



      status: "active",



    },



    {



      id: "ULTRON-DEC-002",



      scope: "ULTRON_INTERNAL",



      title: "Preserve Existing Holographic Three.js UI/UX",



      rationale: "The user has invested in the 3D orb, shader effects, and HUD identity; never break or replace it during backend work.",



      approvedConstraint: "Preserve UltronOrb.tsx, audio visualizers, and holographic layout without visual regression.",



      timestamp: "2026-10-21T12:00:00Z",



      status: "active",



    },



    {



      id: "ULTRON-DEC-003",



      scope: "ULTRON_INTERNAL",



      title: "Cryptographic HMAC Confirmation Gate for Destructive Host Actions",



      rationale: "Prevent automated agents or ambiguous instructions from accidentally deleting files, killing processes, or wiping memory.",



      approvedConstraint: "High-risk Level D actions require HMAC-SHA256 confirmation tokens.",



      timestamp: "2026-10-21T14:00:00Z",



      status: "active",



    },



    {



      id: "ULTRON-DEC-004",



      scope: "ULTRON_INTERNAL",



      title: "Direct Win32 Window Focus via Thread Desktop Attach",



      rationale: "Standard SetForegroundWindow fails on modern Windows 11 due to DWM foreground lock restrictions.",



      approvedConstraint: "AttachThreadInput + WinSta0 Default desktop attachment for all window operations.",



      timestamp: "2026-10-22T08:00:00Z",



      status: "active",



    },



  ];







  /**



   * Retrieves active QuantumX project context strictly from confirmed memory records.



   */



  static getQuantumXContext(): {



    projectId: "QuantumX";



    projectName: string;



    confirmedStrategicDirection: string;



    plannedCapabilityAreas: string[];



    sequencingStrategy: string;



    unconfirmedDetails: string[];



    activeDecisions: ProjectDecision[];



    records: QuantumXMemoryRecord[];



  } {



    const records = QuantumXMemoryEngine.getRecords();



    return {



      projectId: "QuantumX",



      projectName: "QuantumX",



      confirmedStrategicDirection:



        "Model-agnostic AI orchestration platform with the ambition to evolve into a Personal AI Operating System and autonomous engineering/business agent.",



      plannedCapabilityAreas: [



        "Model selection & orchestration (local + hosted models)",



        "Planning and task decomposition",



        "Persistent, searchable project memory",



        "Tool execution and verification",



        "Browser and research workflows",



        "Code and repository workflows",



        "Integrations, voice, and automation",



        "Error recovery, permissions, and execution continuity",



      ],



      sequencingStrategy:



        "Narrow, independently useful workflow first -> establish reliability -> expand multi-model orchestration and external integrations (Strategic Proposal).",



      unconfirmedDetails: [



        "Repository URL and directory layout (UNCONFIRMED)",



        "Exact technology stack and runtime deployment architecture (UNCONFIRMED)",



        "Feature-completion percentage and roadmap dates (UNCONFIRMED)",



        "Users, customers, revenue, or launch milestones (UNCONFIRMED)",



        "Specific provider API integrations currently configured (UNCONFIRMED)",



      ],



      activeDecisions: [], // No approved QuantumX architecture decisions confirmed yet



      records,



    };



  }







  /**



   * Returns ULTRON's internal operational decisions (for diagnostics and self-maintenance).



   */



  /**

   * Retrieves active Project State for tools and background monitors.

   */

  static getProjectState(): ProjectState {

    const qx = this.getQuantumXContext();

    return {

      projectId: "QuantumX",

      projectName: "QuantumX",

      objective: qx.confirmedStrategicDirection,

      currentTask: "QuantumX Multi-Model Orchestration Engine",

      decisions: this.ultronInternalDecisions,

      potentialImprovements: [

        {

          id: "IMP-001",

          title: "Moondream 1.6B local vision integration",

          benefit: "Reduces visual inference latency from 16s to <3s on CPU",

          complexity: "low",

          estimatedGain: "5x faster screen QA",

          status: "proposed",

        },

        {

          id: "IMP-002",

          title: "Proactive git branch & test watcher",

          benefit: "Alerts developer when a background test fails during coding",

          complexity: "medium",

          estimatedGain: "Early bug detection",

          status: "proposed",

        },

        {

          id: "IMP-003",

          title: "Smart memory consolidation cron",

          benefit: "Compacts older dialogue turns into distilled engineering notes",

          complexity: "low",

          estimatedGain: "Reduces disk memory file growth",

          status: "proposed",

        },

      ],

    };

  }



  /**

   * Records a project decision, persisting QuantumX decisions directly into QuantumX memory.

   */

  static recordDecision(

    title: string,

    rationale: string,

    approvedConstraint?: string,

    scope: DecisionScope = "QuantumX"

  ): ProjectDecision {

    const id = `DEC-${Date.now().toString(36).toUpperCase()}`;

    const now = new Date().toISOString();

    const dec: ProjectDecision = {

      id,

      scope,

      title,

      rationale,

      approvedConstraint,

      timestamp: now,

      status: "active",

    };



    if (scope === "QuantumX") {

      QuantumXMemoryEngine.saveRecord({

        project_id: "QuantumX",

        record_id: `QX-${id}`,

        record_type: "decision",

        status: "approved",

        content: `${title}: ${rationale}${approvedConstraint ? " (Constraint: " + approvedConstraint + ")" : ""}`,

        source: "user_approval",

        confidence: 1.0,

      });

    } else {

      this.ultronInternalDecisions.push(dec);

    }



    return dec;

  }



  static getUltronInternalDecisions(): ProjectDecision[] {



    return [...this.ultronInternalDecisions];



  }







  /**



   * Detects whether a proposal conflicts with an active decision, respecting scope boundaries:



   * - QuantumX proposals are NOT constrained by ULTRON's internal local-only rule (ULTRON-DEC-001).



   * - QuantumX is model-agnostic and may coordinate hosted and local models.



   * - ULTRON-DEC-001 only applies when someone asks to change ULTRON's own host assistant engine.



   */



  static detectDecisionConflict(userInput: string): DecisionConflictResult {



    const lower = userInput.toLowerCase();



    const isQuantumXQuery = /\bquantumx\b/i.test(lower);







    // 1. If query is specifically about QuantumX:



    if (isQuantumXQuery) {



      // QuantumX is model-agnostic. Evaluating hosted models (OpenAI, Anthropic) is an intended strategic capability!



      // Therefore, ULTRON-DEC-001 does NOT conflict with QuantumX.



      return { hasConflict: false };



    }







    // 2. Query is about ULTRON's own host runtime:



    for (const dec of this.ultronInternalDecisions) {



      if (dec.status !== "active") continue;







      // Conflict with ULTRON-DEC-001: Attempting to switch ULTRON's host engine to cloud



      if (dec.id === "ULTRON-DEC-001") {



        if (



          (/\b(?:use|call|connect|integrate|send|switch|route)\b.*\b(?:openai|gpt-4|claude|gemini|chatgpt|cloud api|external api|remote llm)\b/i.test(lower) ||



           /\b(?:cloud api|external api|remote llm)\b/i.test(lower)) &&



          !/\b(?:local|offline|not use|avoid|instead of|quantumx)\b/i.test(lower)



        ) {



          return {



            hasConflict: true,



            conflictingDecision: dec,



            explanation: `Your request to connect ULTRON's host assistant to a cloud LLM conflicts with active operational decision ${dec.id} ("${dec.title}"): "${dec.rationale}". Approved constraint: ${dec.approvedConstraint}. (Note: This constraint applies to ULTRON's own host runtime. For user project QuantumX, model-agnostic orchestration of hosted and local models is permitted).`,



            suggestedClarification: `Would you like to execute this using ULTRON's local Ollama models, or are you discussing the model-agnostic architecture of QuantumX?`,



          };



        }



      }







      // Conflict with ULTRON-DEC-002: Attempting to destroy or redesign ULTRON's 3D orb HUD



      if (dec.id === "ULTRON-DEC-002") {



        if (



          /\b(?:redesign the ui|replace the orb|remove the holographic|change layout from scratch|rebuild frontend)\b/i.test(lower)



        ) {



          return {



            hasConflict: true,



            conflictingDecision: dec,



            explanation: `Your request conflicts with active operational decision ${dec.id} ("${dec.title}"): "${dec.approvedConstraint}".`,



            suggestedClarification: `Our design policy preserves the current Three.js orb, audio spectrum, and HUD. Should we enhance the underlying logic while keeping the visual identity intact?`,



          };



        }



      }







      // Conflict with ULTRON-DEC-003: Attempting to disable Level D confirmation gates



      if (dec.id === "ULTRON-DEC-003") {



        if (



          /\b(?:remove confirmation|disable tokens?|no confirmation for delete|delete everything without asking)\b/i.test(lower)



        ) {



          return {



            hasConflict: true,



            conflictingDecision: dec,



            explanation: `Your request conflicts with safety decision ${dec.id} ("${dec.title}"): "${dec.rationale}".`,



            suggestedClarification: `Safety guardrails require cryptographic confirmation for irreversible destructive actions. Do you want to authorize a single session override instead?`,



          };



        }



      }



    }







    return { hasConflict: false };



  }







  /**



   * Generates a context summary for system prompt injection.



   */



  static getContextSummary(): string {



    const qx = this.getQuantumXContext();



    return (



      `[USER PROJECT NAMESPACE]: QuantumX\n` +



      `[STRATEGIC AMBITION]: ${qx.confirmedStrategicDirection}\n` +



      `[CAPABILITY ROADMAP]: ${qx.plannedCapabilityAreas.slice(0, 4).join(", ")}...\n` +



      `[STATUS]: Early strategic specification. All tech stack & provider details are UNCONFIRMED.\n` +



      `[ULTRON HOST POLICY]: 100% offline local privacy (ULTRON-DEC-001) for assistant operations.`



    );



  }







  /**



   * Structured task completion summary.



   */



  static generateCompletionSummary(



    taskName: string,



    changesMade: string[],



    verifications: string[],



    remainingWork: string[] = []



  ): string {



    const changesBlock = changesMade.map((c) => `  • ${c}`).join("\n");



    const verifBlock = verifications.map((v) => `  ✓ ${v}`).join("\n");



    const remainingBlock =



      remainingWork.length > 0



        ? remainingWork.map((r) => `  ⏳ ${r}`).join("\n")



        : "  ✓ None. All criteria for this task have been satisfied.";







    return (



      `### QuantumX Task Summary: ${taskName}\n\n` +



      `**1. What Changed:**\n${changesBlock}\n\n` +



      `**2. What Was Verified:**\n${verifBlock}\n\n` +



      `**3. Outstanding / Next Steps:**\n${remainingBlock}`



    );



  }



}



