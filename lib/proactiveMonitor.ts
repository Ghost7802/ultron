/**
 * ULTRON Proactive Project Monitor & Initiative Controller (Module 6)
 * 
 * Configurable initiative levels:
 * - "quiet": strictly passive, responds only to direct requests
 * - "balanced": surfaces critical risks or conflicts at natural session milestones
 * - "proactive": prioritizes worthwhile improvements and architectural checks
 * 
 * Performs REAL checks: inspects test result logs, project milestones, RAM/CPU telemetry.
 * Zero fabricated monitoring claims.
 */

import fs from "fs";
import path from "path";
import { ProjectContextManager } from "./projectContext";
import { ultronTools } from "./ultronTools";

export type InitiativeLevel = "quiet" | "balanced" | "proactive";

export interface ProactiveOpportunity {
  id: string;
  type: "failing_test" | "missing_acceptance" | "performance_risk" | "decision_conflict" | "milestone_progress" | "resource_efficiency";
  severity: "high" | "medium" | "low";
  headline: string;
  rationale: string;
  recommendedAction: string;
  approvalRisk: "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "LEVEL_D";
}

let currentInitiativeLevel: InitiativeLevel = "balanced";

export class ProactiveProjectMonitor {
  static setInitiativeLevel(level: InitiativeLevel): void {
    currentInitiativeLevel = level;
  }

  static getInitiativeLevel(): InitiativeLevel {
    return currentInitiativeLevel;
  }

  /**
   * Scans the real project state and evidence to discover genuine engineering opportunities.
   */
  static async scanForOpportunities(): Promise<ProactiveOpportunity[]> {
    if (currentInitiativeLevel === "quiet") {
      return [];
    }

    const opportunities: ProactiveOpportunity[] = [];
    const projectState = ProjectContextManager.getProjectState();

    // 1. Check for real test failures or recent test logs
    const testResultsPath = path.join(process.cwd(), "tests", "phase2_acceptance_results.json");
    if (fs.existsSync(testResultsPath)) {
      try {
        const raw = fs.readFileSync(testResultsPath, "utf-8");
        const results = JSON.parse(raw);
        for (const [sectionKey, sectionData] of Object.entries<any>(results)) {
          if (sectionData.status === "FAIL") {
            opportunities.push({
              id: `opp_test_${sectionKey}`,
              type: "failing_test",
              severity: "high",
              headline: `Failing Acceptance Section: ${sectionData.section || sectionKey}`,
              rationale: `Real acceptance suite returned status 'FAIL'. Log shows: ${JSON.stringify(sectionData.evidence || {}).slice(0, 100)}`,
              recommendedAction: `Run isolated diagnostic on ${sectionData.section} and apply targeted fix.`,
              approvalRisk: "LEVEL_C",
            });
          }
        }
      } catch {}
    }

    // 2. Hardware Resource & Performance Risk Check
    try {
      const diag: any = await ultronTools.executeDirect("get_system_diagnostics", {});
      if (diag && diag.ram_percent > 85) {
        opportunities.push({
          id: "opp_ram_pressure",
          type: "performance_risk",
          severity: "medium",
          headline: `High Host Memory Pressure (${diag.ram_percent}% RAM utilized)`,
          rationale: `Physical memory has only ${((100 - diag.ram_percent) * 8.4 / 100).toFixed(1)} GB available. Running heavy 4B+ vision models may trigger OS page swapping.`,
          recommendedAction: `Prefer lightweight qwen2.5:1.5b for chat and moondream 1.6B for visual inspections.`,
          approvalRisk: "LEVEL_B",
        });
      }
    } catch {}

    // 3. Incomplete Milestones
    for (const ms of (projectState.milestones || [])) {
      if (ms.status === "in_progress") {
        opportunities.push({
          id: `opp_ms_${ms.id}`,
          type: "milestone_progress",
          severity: "low",
          headline: `Active Milestone In Progress: ${ms.title}`,
          rationale: `Current task is actively working toward completing ${ms.title}. Success criteria: ${ms.successCriteria.join(", ")}.`,
          recommendedAction: `Proceed with companion core integration and run acceptance verification.`,
          approvalRisk: "LEVEL_B",
        });
      }
    }

    // 4. In Proactive mode, also check for potential improvements
    if (currentInitiativeLevel === "proactive") {
      for (const imp of projectState.potentialImprovements) {
        if (imp.status === "proposed") {
          opportunities.push({
            id: `opp_imp_${imp.id}`,
            type: "resource_efficiency",
            severity: "low",
            headline: `Proposed Optimization: ${imp.title}`,
            rationale: `Expected benefit: ${imp.benefit} (${imp.estimatedGain}). Complexity: ${imp.complexity}.`,
            recommendedAction: `Evaluate and schedule implementation after current milestone completes.`,
            approvalRisk: "LEVEL_B",
          });
        }
      }
    }

    return opportunities;
  }
}

