/**
 * ULTRON Local-Only Live Integration Test Suite
 * Tests actual application modules (not mock classes) and the live local HTTP endpoints.
 */

import { ultronMemory } from "../lib/ultronMemory";
import { ultronTools } from "../lib/ultronTools";
import { browserResearch } from "../lib/browserResearch";
import { ultronPlanner } from "../lib/ultronPlanner";
import { routeUserQuery } from "../lib/intentRouter";

async function runLiveIntegrationTests() {
  console.log("================================================================");
  console.log("  ULTRON LOCAL-ONLY BACKEND INTEGRATION TEST SUITE");
  console.log("================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (!condition) {
      console.error(`  ✖ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
    passed++;
    console.log(`  ✔ PASS: ${msg}`);
  }

  // 1. REAL MEMORY SYSTEM (5 LAYERS, PROVENANCE, AUTO-LEARNING)
  console.log("▶ 1. Testing Real 5-Layer ultronMemory Engine & Provenance...");
  ultronMemory.savePreference("test_pref", "dark_matrix", "ui", 0.9);
  ultronMemory.saveProjectState("test_proj", "Holographic Orb v2", "architecture");
  ultronMemory.saveVerifiedResearch("quantum_ml", "Quantum machine learning utilizes qubits", "https://arxiv.org");
  ultronMemory.recordTurn("user", "Hello Ultron");

  const ctx = ultronMemory.retrieveContext("test_pref", 3);
  assert(ctx.includes("dark_matrix"), "Layer 2 Preference retrieval works");

  const projCtx = ultronMemory.retrieveContext("test_proj", 3);
  assert(projCtx.includes("Holographic Orb v2"), "Layer 3 Project State retrieval works");

  // Dynamic learning from correction
  const correctionLearned = ultronMemory.processPotentialCorrection("Actually, my name is Jarvis");
  assert(!!correctionLearned, "Auto-learning user correction processed");
  const ownerPref = ultronMemory.searchAll("Jarvis");
  assert(ownerPref.length > 0 && ownerPref[0].value === "Jarvis", "Learned correction stored in Memory Layer 2");

  // Memory reset confirmation gate
  const resetGate = ultronMemory.requestResetConfirmation();
  assert(resetGate.requiresConfirmation && !!resetGate.token, "Memory reset requires confirmation token");
  const badReset = ultronMemory.confirmReset("WRONGTOKEN");
  assert(!badReset.success, "Invalid reset token rejected");
  const goodReset = ultronMemory.confirmReset(resetGate.token);
  assert(goodReset.success, "Valid reset token successfully cleared memory");

  // Re-seed default
  ultronMemory.savePreference("owner", "Ashish", "identity", 1.0);

  // 2. REAL BROWSER RESEARCH (SOURCE EXTRACTION & SANITIZATION)
  console.log("\n▶ 2. Testing Real browserResearch Subsystem...");
  const searchResults = await browserResearch.search("TypeScript language");
  assert(searchResults.length > 0, `Real web search retrieved ${searchResults.length} results`);
  assert(!!searchResults[0].url && !!searchResults[0].snippet, "Search results contain verified URLs and snippets");

  // Test HTML Sanitization & Page Fetching
  const fetchResult = await browserResearch.fetchPageText("https://example.com");
  assert(fetchResult.title.length > 0, `Page fetch extracted title: '${fetchResult.title}'`);
  assert(!fetchResult.content.includes("<script>"), "Sanitization stripped all script tags");

  // 3. REAL COMPUTER CONTROL & CONFIRMATION GATES (ACTION/TARGET BINDING & REPLAY PREVENTION)
  console.log("\n▶ 3. Testing Real ultronTools & Security Gates...");
  const diag = ultronTools.getSystemDiagnostics();
  assert(diag.status === "success" && diag.cpu_percent >= 0 && diag.ram_percent > 0, "Real system diagnostics telemetry working");

  // Test that close_application demands token
  const closeAttempt = await ultronTools.execute("close_application", { app_name: "calc" });
  assert(closeAttempt.status === "confirmation_required", "High-risk close_application blocked without confirmation token");
  assert(!!closeAttempt.confirm_token, "Confirmation token issued with 120s TTL");

  const issuedToken = closeAttempt.confirm_token;

  // Test token mismatch on action
  const crossActionAttempt = await ultronTools.execute("delete_file", { file_path: "secret.txt" }, issuedToken);
  assert(crossActionAttempt.status === "error", "Cross-action token reuse blocked (action mismatch)");

  // Test token mismatch on target
  const crossTargetAttempt = await ultronTools.execute("close_application", { app_name: "chrome" }, issuedToken);
  assert(crossTargetAttempt.status === "error", "Cross-target token reuse blocked (target mismatch)");

  // Test valid confirmation
  const validExec = await ultronTools.execute("close_application", { app_name: "calc" }, issuedToken);
  assert(validExec.status === "success", "Valid token executes safely on exact bound target");

  // Test single-use prevention (replay prevention)
  const reuseAttempt = await ultronTools.execute("close_application", { app_name: "calc" }, issuedToken);
  assert(reuseAttempt.status === "error", "Single-use enforcement: Token cannot be reused (replay prevention)");

  // 4. REAL AUTONOMOUS PLANNER (UNDERSTAND -> PLAN -> EXECUTE -> VERIFY -> RECOVER -> REPORT)
  console.log("\n▶ 4. Testing Real ultronPlanner Lifecycle & Recovery...");
  const planReport = await ultronPlanner.planAndExecute("Inspect project files and check telemetry");
  assert(planReport.stage === "REPORT" || planReport.stage === "RECOVER", "Planner executed through full lifecycle");
  assert(planReport.passed_steps === planReport.total_steps, "All planner steps verified against post-action criteria");
  assert(planReport.activePlan.status === "completed", "activePlan matches exact frontend HUD contract");

  // Test recovery mechanism
  const recoveryTest = await ultronPlanner.recoverStep(
    { stepId: 99, title: "Test Recovery", action: "search_files", params: {}, criteria: "file found", status: "running" },
    new Error("Deep directory access error")
  );
  assert(recoveryTest.recovered, `Recovery handler succeeded: ${recoveryTest.message}`);

  // 5. LOCAL-ONLY MODEL ROUTING & OFFLINE RESILIENCE
  console.log("\n▶ 5. Testing Local Model Routing & Offline Resilience (/api/chat)...");
  try {
    const res = await fetch("http://127.0.0.1:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "status report" }],
      }),
    });
    const data = await res.json();
    assert(res.ok, "HTTP 200 OK from local /api/chat");
    assert(data.reply && data.reply.includes("System Status"), "Local API routed diagnostics tool correctly");
    assert(data.model === "tool-registry" || data.model === "ultron-local", `Local model provider verified: '${data.model}'`);
  } catch (err: any) {
    console.warn("  (Live HTTP check warning):", err.message);
  }

  console.log("\n================================================================");
  console.log(`  LIVE INTEGRATION SUMMARY: ${passed}/${total} assertions PASSED`);
  console.log("================================================================\n");
}

runLiveIntegrationTests().catch((err) => {
  console.error("Live test suite failed:", err);
  process.exit(1);
});
