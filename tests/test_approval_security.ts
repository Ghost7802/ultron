/**
 * Automated Verification Suite: Level D Cryptographic Approval & Execution Security
 * 
 * Verifies:
 * 1. Valid approval token verification -> SUCCESS (valid: true)
 * 2. Invalid or tampered token -> REJECTED (valid: false)
 * 3. Expired token -> REJECTED (TTL enforcement)
 * 4. Replay prevention -> Re-using consumed token REJECTED
 * 5. Parameter substitution attack -> Replaced target params REJECTED
 * 6. Action substitution attack -> Replaced action name REJECTED
 * 7. Fail-closed behavior on null/empty/malformed inputs
 * 8. 4-tier risk classification accuracy across Level A-D
 */

import assert from "assert";
import { ResponsibleAutonomyPolicy } from "../lib/approvalPolicy";

async function runApprovalSecurityTests() {
  console.log("================================================================================");
  console.log("   TEST SUITE: LEVEL D APPROVAL GATE & EXECUTION SECURITY");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function runTest(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  // 1. Valid approval token verification
  runTest("Valid approval token generates and verifies successfully", () => {
    const gate = ResponsibleAutonomyPolicy.createApprovalGate({
      actionName: "delete_file",
      params: { path: "C:\\projects\\scratch\\temp.log" },
      whatWillChange: "Delete temporary log file",
      whyUseful: "Reclaims disk space",
      affectedResources: ["C:\\projects\\scratch\\temp.log"],
      risksAndRollback: "File permanently deleted; no rollback",
      verificationPlan: "Check file existence after deletion",
    });

    assert.ok(gate.approvalRequest.token, "Token must be generated");
    assert.strictEqual(gate.approvalRequest.token.length >= 8, true, "Token must have high entropy");

    const verification = ResponsibleAutonomyPolicy.verifyApprovalToken(
      gate.approvalRequest.token,
      "delete_file",
      { path: "C:\\projects\\scratch\\temp.log" }
    );

    assert.strictEqual(verification.valid, true, "Verification must succeed for valid matching token");
    assert.ok(verification.request, "Must return approved request object");
  });

  // 2. Tampered token rejection
  runTest("Tampered token is rejected immediately", () => {
    const gate = ResponsibleAutonomyPolicy.createApprovalGate({
      actionName: "kill_process",
      params: { pid: 9999 },
      whatWillChange: "Terminate test process",
      whyUseful: "Clean shutdown",
      affectedResources: ["PID 9999"],
      risksAndRollback: "Process terminates",
      verificationPlan: "Check process list",
    });

    // Tamper by altering the last character
    const tampered = gate.approvalRequest.token.slice(0, -1) + (gate.approvalRequest.token.endsWith("A") ? "B" : "A");

    const result = ResponsibleAutonomyPolicy.verifyApprovalToken(tampered, "kill_process", { pid: 9999 });
    assert.strictEqual(result.valid, false, "Tampered token must be rejected");
  });

  // 3. Expired token rejection
  runTest("Expired token is rejected and purged", () => {
    const gate = ResponsibleAutonomyPolicy.createApprovalGate({
      actionName: "delete_file",
      params: { path: "C:\\temp\\old.txt" },
      whatWillChange: "Delete file",
      whyUseful: "Cleanup",
      affectedResources: ["C:\\temp\\old.txt"],
      risksAndRollback: "None",
      verificationPlan: "Verify",
    });

    // Artificially expire the token
    gate.approvalRequest.expiresAt = Date.now() - 1000;

    const result = ResponsibleAutonomyPolicy.verifyApprovalToken(
      gate.approvalRequest.token,
      "delete_file",
      { path: "C:\\temp\\old.txt" }
    );

    assert.strictEqual(result.valid, false, "Expired token must be rejected");
    assert(result.reason?.includes("expired"), "Must cite token expiration");
  });

  // 4. Replay attack rejection (single-use consumption)
  runTest("Replay attack: reusing a consumed token is rejected", () => {
    const gate = ResponsibleAutonomyPolicy.createApprovalGate({
      actionName: "memory_reset",
      params: { scope: "scratch" },
      whatWillChange: "Clear scratch notes",
      whyUseful: "Clean slate",
      affectedResources: ["scratch"],
      risksAndRollback: "Cleared",
      verificationPlan: "Verify empty",
    });

    // First use: valid
    const firstUse = ResponsibleAutonomyPolicy.verifyApprovalToken(
      gate.approvalRequest.token,
      "memory_reset",
      { scope: "scratch" }
    );
    assert.strictEqual(firstUse.valid, true, "First token use must be valid");

    // Second use (replay): REJECTED
    const secondUse = ResponsibleAutonomyPolicy.verifyApprovalToken(
      gate.approvalRequest.token,
      "memory_reset",
      { scope: "scratch" }
    );
    assert.strictEqual(secondUse.valid, false, "Reused token must be rejected");
    assert(secondUse.reason?.includes("Replay") || secondUse.reason?.includes("Invalid"), "Must reject replay");
  });

  // 5. Parameter substitution attack rejection
  runTest("Parameter substitution attack is rejected", () => {
    const gate = ResponsibleAutonomyPolicy.createApprovalGate({
      actionName: "delete_file",
      params: { path: "C:\\safe\\test.txt" },
      whatWillChange: "Delete safe file",
      whyUseful: "Test",
      affectedResources: ["C:\\safe\\test.txt"],
      risksAndRollback: "Safe",
      verificationPlan: "Verify",
    });

    // Attacker tries using the token to delete a system file
    const attack = ResponsibleAutonomyPolicy.verifyApprovalToken(
      gate.approvalRequest.token,
      "delete_file",
      { path: "C:\\Windows\\System32\\critical.dll" }
    );

    assert.strictEqual(attack.valid, false, "Substituted parameter must be rejected");
    assert(attack.reason?.includes("target"), "Must cite target mismatch");
  });

  // 6. Action substitution attack rejection
  runTest("Action substitution attack is rejected", () => {
    const gate = ResponsibleAutonomyPolicy.createApprovalGate({
      actionName: "delete_file",
      params: { path: "C:\\temp\\log.txt" },
      whatWillChange: "Delete log",
      whyUseful: "Cleanup",
      affectedResources: ["C:\\temp\\log.txt"],
      risksAndRollback: "Safe",
      verificationPlan: "Verify",
    });

    // Attacker tries using the token to execute kill_process
    const attack = ResponsibleAutonomyPolicy.verifyApprovalToken(
      gate.approvalRequest.token,
      "kill_process",
      { path: "C:\\temp\\log.txt" }
    );

    assert.strictEqual(attack.valid, false, "Substituted action must be rejected");
    assert(attack.reason?.includes("action"), "Must cite action mismatch");
  });

  // 7. Fail-closed behavior on null/empty/malformed input
  runTest("Fail-closed behavior on invalid inputs", () => {
    assert.strictEqual(ResponsibleAutonomyPolicy.verifyApprovalToken("").valid, false);
    assert.strictEqual(ResponsibleAutonomyPolicy.verifyApprovalToken("ABC").valid, false);
    assert.strictEqual(ResponsibleAutonomyPolicy.verifyApprovalToken(null as any).valid, false);
    assert.strictEqual(ResponsibleAutonomyPolicy.verifyApprovalToken(undefined as any).valid, false);
  });

  // 8. Risk classification accuracy across Level A-D
  runTest("Risk classification accuracy across Level A-D tiers", () => {
    // Level A: Observe
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("get_system_diagnostics"), "LEVEL_A");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("enumerate_windows"), "LEVEL_A");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("capture_screen"), "LEVEL_A");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("read_file"), "LEVEL_A");

    // Level B: Recommend
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("propose_plan"), "LEVEL_B");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("unknown_reasoning_step"), "LEVEL_B");

    // Level C: Safe Execution
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("focus_window"), "LEVEL_C");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("click_ui_element"), "LEVEL_C");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("browse_web"), "LEVEL_C");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("run_command", { command: "dir" }), "LEVEL_C");

    // Level D: Destructive Action
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("delete_file"), "LEVEL_D");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("kill_process"), "LEVEL_D");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("memory_reset"), "LEVEL_D");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("run_command", { command: "rmdir /s /q c:\\temp" }), "LEVEL_D");
    assert.strictEqual(ResponsibleAutonomyPolicy.classifyRisk("run_command", { command: "del /f /q *.*" }), "LEVEL_D");
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runApprovalSecurityTests();
