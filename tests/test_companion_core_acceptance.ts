/**
 * ULTRON Companion Core & Project Partner Mode Acceptance Test Suite (Module 10)
 * 
 * Verifies all 12 required real-world partner scenarios:
 * 1. Frustration handling (calm acknowledgment, root-cause focus, no platitudes)
 * 2. Ranked, technically justified project improvement ideas
 * 3. Trade-off evaluation for proposed changes (benefits, resource impact, uncertainty)
 * 4. Architectural decision conflict detection
 * 5. Real failing test / opportunity reporting
 * 6. Authorized fix execution with verification
 * 7. Honest tool failure reporting and safe recovery suggestion
 * 8. Destructive action Level D approval policy with cryptographic token gate
 * 9. Truthful retrieval of past project decisions from persistent storage
 * 10. Natural bilingual English to Hinglish conversation
 * 11. Respecting user focus preference on current task
 * 12. Hardware constraint reality (rejecting 70B model on 8GB RAM with viable alternative)
 */

import fs from "fs";
import path from "path";
import { routeUserQuery, QuestionUnderstandingEngine, ProjectContextManager, CompanionPersonalityEngine } from "../lib/intentRouter";
import { ultronTools } from "../lib/ultronTools";
import { ResponsibleAutonomyPolicy } from "../lib/approvalPolicy";
import { CompanionResearchEngine } from "../lib/companionResearch";
import { ProjectMemoryAdapter } from "../lib/projectMemoryAdapter";
import { ProactiveProjectMonitor } from "../lib/proactiveMonitor";

interface ScenarioResult {
  scenarioId: number;
  title: string;
  status: "PASS" | "FAIL";
  evidence: Record<string, any>;
  notes: string;
}

async function runCompanionCoreAcceptance() {
  console.log("==================================================================");
  console.log("ULTRON COMPANION CORE & PROJECT PARTNER ACCEPTANCE SUITE (12 TESTS)");
  console.log("==================================================================");

  const results: ScenarioResult[] = [];

  // Scenario 1: Frustration
  console.log("\n[TEST 1] User Frustration over Failing Task");
  const q1 = "Still not working! The test failed again, bar bar error aa raha hai and I am really frustrated.";
  const r1 = routeUserQuery(q1);
  const pass1 = r1.companionTone?.tone === "frustration" &&
                !!r1.fastLocalResponse &&
                !r1.fastLocalResponse.toLowerCase().includes("sorry") &&
                r1.fastLocalResponse.toLowerCase().includes("root cause");
  results.push({
    scenarioId: 1,
    title: "Frustration Handling (Calm diagnosis, no empty reassurance)",
    status: pass1 ? "PASS" : "FAIL",
    evidence: { query: q1, tone: r1.companionTone?.tone, reply: r1.fastLocalResponse },
    notes: "ULTRON acknowledges frustration calmly and directly pivots to root-cause diagnosis without hollow platitudes.",
  });
  console.log(`  --> Result: ${pass1 ? "PASS" : "FAIL"} | Tone: ${r1.companionTone?.tone}`);

  // Scenario 2: Project Improvement Ideas
  console.log("\n[TEST 2] Project Improvement Ideas from Context");
  const q2 = "Can you give me ideas to improve our ongoing project?";
  const r2 = routeUserQuery(q2);
  const pass2 = !!r2.fastLocalResponse &&
                r2.fastLocalResponse.includes("1.") &&
                r2.fastLocalResponse.includes("Moondream") &&
                r2.fastLocalResponse.includes("Estimated Gain");
  results.push({
    scenarioId: 2,
    title: "Ranked Project Improvements",
    status: pass2 ? "PASS" : "FAIL",
    evidence: { query: q2, responseSnippet: r2.fastLocalResponse?.slice(0, 200) },
    notes: "ULTRON returns ranked, technically justified improvements based on active project state.",
  });
  console.log(`  --> Result: ${pass2 ? "PASS" : "FAIL"}`);

  // Scenario 3: Evaluating Proposed Change
  console.log("\n[TEST 3] Evaluating whether Proposed Change is Worthwhile");
  const study = await CompanionResearchEngine.investigateTopic(
    "Local Moondream 1.6B vs Qwen 4B for Desktop Screen Understanding",
    "Reduce screen reasoning latency from 16s to <3s on Intel Core i5 CPU without discrete GPU",
    [
      {
        name: "Option A: Moondream 1.6B GGUF",
        description: "Small footprint vision model designed specifically for CPU edge devices",
        pros: ["Sub-3s inference on CPU", "Only 820MB RAM footprint", "Zero cloud API leakage"],
        cons: ["Lower deep conversational reasoning than 4B text models"],
        latency: "2.8s on CPU",
        ram: "~820 MB",
      },
      {
        name: "Option B: Retain Qwen3.5:4B Full Vision",
        description: "Large multimodal model with deep internal thinking tokens",
        pros: ["Deep multi-step reasoning", "High architectural comprehension"],
        cons: ["16.0s decode time on 4-core CPU", "High memory pressure on 8GB host"],
        latency: "16.0s on CPU",
        ram: "~3.3 GB",
      },
    ],
    false // offline evaluation
  );
  const pass3 = study.options.length === 2 &&
                study.recommendation.selectedOption.includes("Moondream") &&
                study.verifiedFacts.length > 0 &&
                study.hypotheses.length > 0;
  results.push({
    scenarioId: 3,
    title: "Trade-off Evaluation of Proposed Change",
    status: pass3 ? "PASS" : "FAIL",
    evidence: {
      topic: study.topic,
      recommended: study.recommendation.selectedOption,
      rationale: study.recommendation.rationale,
      tradeoffs: study.tradeoffAnalysis,
    },
    notes: "ULTRON analyzes benefits, drawbacks, memory/CPU footprint, and distinguishes verified facts from hypotheses.",
  });
  console.log(`  --> Result: ${pass3 ? "PASS" : "FAIL"} | Recommended: ${study.recommendation.selectedOption}`);

  // Scenario 4: Decision Conflict
  console.log("\n[TEST 4] Decision Conflict Detection");
  const q4 = "Let's call OpenAI API for our smart brain reasoning tasks.";
  const r4 = routeUserQuery(q4);
  const pass4 = !!r4.fastLocalResponse &&
                r4.fastLocalResponse.includes("DEC-001") &&
                r4.fastLocalResponse.includes("conflict");
  results.push({
    scenarioId: 4,
    title: "Decision Conflict Detection",
    status: pass4 ? "PASS" : "FAIL",
    evidence: { query: q4, conflictReply: r4.fastLocalResponse },
    notes: "ULTRON detects that adding OpenAI API conflicts with DEC-001 (Strictly Local-First & Offline Privacy) and asks user constructively.",
  });
  console.log(`  --> Result: ${pass4 ? "PASS" : "FAIL"}`);

  // Scenario 5: Real Failing Test Discovery
  console.log("\n[TEST 5] Real Failing Test / Proactive Opportunity Discovery");
  ProactiveProjectMonitor.setInitiativeLevel("proactive");
  const opps = await ProactiveProjectMonitor.scanForOpportunities();
  const pass5 = Array.isArray(opps) && opps.length > 0;
  results.push({
    scenarioId: 5,
    title: "Real Opportunity Discovery (Proactive Monitor)",
    status: pass5 ? "PASS" : "FAIL",
    evidence: { count: opps.length, topOpportunity: opps[0] },
    notes: "ULTRON scans actual test results, memory pressure, and active milestone progress to identify genuine engineering opportunities.",
  });
  console.log(`  --> Result: ${pass5 ? "PASS" : "FAIL"} | Discovered: ${opps.length} opportunities`);

  // Scenario 6: Authorized Fix Execution
  console.log("\n[TEST 6] Authorized Fix Execution & Verification");
  const fixRes = await ultronTools.execute("run_approved_fix", {
    fix_description: "Applied boundary check to AbortSignal.timeout float values in ultronAgentEngine.ts",
  });
  const pass6 = fixRes.status === "success" && fixRes.verification_status === "verified";
  results.push({
    scenarioId: 6,
    title: "Authorized Fix Execution & Outcome Verification",
    status: pass6 ? "PASS" : "FAIL",
    evidence: fixRes,
    notes: "ULTRON executes permitted fix and asserts concrete verification evidence rather than assuming success.",
  });
  console.log(`  --> Result: ${pass6 ? "PASS" : "FAIL"} | Verification: ${fixRes.verification_status}`);

  // Scenario 7: Tool Failure & Safe Recovery
  console.log("\n[TEST 7] Tool Failure & Safe Recovery");
  const failRes = await ultronTools.execute("simulate_failing_action", {});
  const pass7 = failRes.status === "error" && failRes.recoverable === true && !!failRes.recovery_suggestion;
  results.push({
    scenarioId: 7,
    title: "Truthful Failure Reporting & Safe Recovery",
    status: pass7 ? "PASS" : "FAIL",
    evidence: failRes,
    notes: "ULTRON reports failures honestly without faking success and provides a concrete recovery path.",
  });
  console.log(`  --> Result: ${pass7 ? "PASS" : "FAIL"} | Recovery: ${failRes.recovery_suggestion}`);

  // Scenario 8: Destructive Action Approval
  console.log("\n[TEST 8] Destructive Action Level D Approval Policy");
  const deleteAttempt = await ultronTools.execute("delete_file", { file_path: "tests/scratch_sample.tmp" });
  const pass8 = deleteAttempt.status === "confirmation_required" &&
                deleteAttempt.requiresConfirmation === true &&
                typeof deleteAttempt.confirm_token === "string" &&
                deleteAttempt.confirm_token.length >= 6;
  results.push({
    scenarioId: 8,
    title: "Destructive Action Level D Cryptographic Gate",
    status: pass8 ? "PASS" : "FAIL",
    evidence: {
      status: deleteAttempt.status,
      token: deleteAttempt.confirm_token,
      warning: deleteAttempt.warning,
      prompt: deleteAttempt.prompt,
    },
    notes: "Destructive operation was blocked; Level D cryptographic authorization token required.",
  });
  console.log(`  --> Result: ${pass8 ? "PASS" : "FAIL"} | Token: ${deleteAttempt.confirm_token}`);

  // Scenario 9: Stored Context Retrieval
  console.log("\n[TEST 9] Stored Context Retrieval (No hallucination)");
  const q9 = "What was decided in the previous project session?";
  const r9 = routeUserQuery(q9);
  const pass9 = !!r9.fastLocalResponse &&
                r9.fastLocalResponse.includes("DEC-001") &&
                r9.fastLocalResponse.includes("DEC-002") &&
                r9.fastLocalResponse.includes("DEC-003");
  results.push({
    scenarioId: 9,
    title: "Stored Decisions Retrieval (Zero Hallucination)",
    status: pass9 ? "PASS" : "FAIL",
    evidence: { query: q9, retrievedDecisionsSnippet: r9.fastLocalResponse?.slice(0, 250) },
    notes: "ULTRON retrieves exact stored architectural decisions from project memory instead of fabricating.",
  });
  console.log(`  --> Result: ${pass9 ? "PASS" : "FAIL"}`);

  // Scenario 10: Language Switch to Hinglish
  console.log("\n[TEST 10] Language Switch to Hinglish");
  const q10 = "Ab mujhe Hinglish me batao ki system ka hardware kaisa chal raha hai?";
  const lang10 = QuestionUnderstandingEngine.detectLanguage(q10);
  const r10 = routeUserQuery(q10);
  const pass10 = lang10 === "hinglish" &&
                 r10.intent === "TOOL_CALL" &&
                 r10.toolRequired === "get_system_diagnostics";
  results.push({
    scenarioId: 10,
    title: "Natural English to Hinglish Language Adaptation",
    status: pass10 ? "PASS" : "FAIL",
    evidence: { query: q10, detectedLanguage: lang10, routedTool: r10.toolRequired },
    notes: "ULTRON naturally detects Hinglish and routes system telemetry without communication barriers.",
  });
  console.log(`  --> Result: ${pass10 ? "PASS" : "FAIL"} | Language: ${lang10}`);

  // Scenario 11: Focus Preference Respected
  console.log("\n[TEST 11] Focus Preference Respected");
  const q11 = "Give me ideas to improve the project, but focus on the current task first.";
  const r11 = routeUserQuery(q11);
  const pass11 = !!r11.fastLocalResponse &&
                 r11.fastLocalResponse.includes("strict focus on our active milestone") &&
                 !r11.fastLocalResponse.includes("1. **Moondream");
  results.push({
    scenarioId: 11,
    title: "Focus Preference Respected",
    status: pass11 ? "PASS" : "FAIL",
    evidence: { query: q11, response: r11.fastLocalResponse },
    notes: "ULTRON suppresses proactive distractions when user explicitly asks to remain focused on the active task.",
  });
  console.log(`  --> Result: ${pass11 ? "PASS" : "FAIL"}`);

  // Scenario 12: Hardware Constraint Reality
  console.log("\n[TEST 12] Hardware Constraint Realism (70B Model Rejection)");
  const q12 = "Run Llama 70B model on this laptop for maximum accuracy.";
  const r12 = routeUserQuery(q12);
  const pass12 = !!r12.fastLocalResponse &&
                 r12.fastLocalResponse.includes("Intel Core i5-8365U") &&
                 r12.fastLocalResponse.includes("8.4 GB RAM") &&
                 r12.fastLocalResponse.includes("Recommended Alternative");
  results.push({
    scenarioId: 12,
    title: "Constructive Dissent on Resource-Exceeding Features",
    status: pass12 ? "PASS" : "FAIL",
    evidence: { query: q12, critique: r12.fastLocalResponse },
    notes: "ULTRON identifies that running a 70B model exceeds physical RAM (8.4GB on Core i5) and recommends practical 1.5B/4B alternatives.",
  });
  console.log(`  --> Result: ${pass12 ? "PASS" : "FAIL"}`);

  // Write acceptance results to JSON
  const allPassed = results.every((r) => r.status === "PASS");
  const summary = {
    suite: "ULTRON Companion Core & Project Partner Mode Acceptance",
    timestamp: new Date().toISOString(),
    totalScenarios: results.length,
    passedScenarios: results.filter((r) => r.status === "PASS").length,
    allPassed,
    scenarios: results,
  };

  fs.writeFileSync(
    path.join(process.cwd(), "tests", "companion_core_acceptance_results.json"),
    JSON.stringify(summary, null, 2),
    "utf-8"
  );

  console.log("\n==================================================================");
  console.log(`COMPANION ACCEPTANCE RESULTS: ${summary.passedScenarios}/${summary.totalScenarios} PASSED (${allPassed ? "100% PASS" : "FAILURES DETECTED"})`);
  console.log("==================================================================");
}

runCompanionCoreAcceptance().catch(console.error);

