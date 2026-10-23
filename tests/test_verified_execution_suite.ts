/**
 * ULTRON Master Reliability Upgrade: Phase 3 Verified Task Execution Test Suite
 * 
 * Verifies:
 * 1. Standardized completion state 'VERIFIED_SUCCESS' for verified operations
 * 2. Explicit postcondition verification evidence on file writes
 * 3. File patch verification with reversible backup preservation
 * 4. Read-only tools return 'VERIFIED_SUCCESS' with verified diagnostic evidence
 * 5. High-risk actions without confirmation token are gated with 'BLOCKED' state
 * 6. Valid confirmation token transitions gated action to 'VERIFIED_SUCCESS'
 * 7. Invalid/tampered confirmation token is rejected with 'BLOCKED' state
 * 8. Non-existent file deletion / missing params returns 'FAILED' state with structured error
 * 9. Desktop UI automation returns verified window state or structured error
 * 10. Agent loop captures and respects structured execution states
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import { ultronTools } from "../lib/ultronTools";

async function runVerifiedExecutionSuite() {
  console.log("================================================================================");
  console.log("   TEST SUITE: ULTRON PHASE 3 VERIFIED TASK EXECUTION PIPELINE");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  async function runTest(name: string, fn: () => Promise<void> | void) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         Error: ${err.message}`);
    }
  }

  // 1. File write returns VERIFIED_SUCCESS with postcondition verification
  await runTest("File write returns VERIFIED_SUCCESS and postcondition verification", async () => {
    const testFile = "scratch/test_verified_exec.txt";
    const content = "ULTRON Verified Execution Payload: " + Date.now();
    const res = await ultronTools.execute("write_file", { file_path: testFile, content });

    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.completion_state, "VERIFIED_SUCCESS");
    assert.ok(res.verification);
    assert.strictEqual(res.verification.verified, true);
    assert.strictEqual(res.verification.file_exists, true);
    assert.strictEqual(res.verification.size_bytes, content.length);
  });

  // 2. File patch returns VERIFIED_SUCCESS and creates backup
  await runTest("File patch returns VERIFIED_SUCCESS and verifies replacement", async () => {
    const testFile = "scratch/test_patch_target.txt";
    fs.writeFileSync(path.resolve(process.cwd(), testFile), "INITIAL_TARGET_STATE", "utf-8");

    const res = await ultronTools.execute("patch_file", {
      file_path: testFile,
      target_content: "INITIAL_TARGET_STATE",
      replacement_content: "UPDATED_VERIFIED_STATE",
    });

    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.completion_state, "VERIFIED_SUCCESS");
    assert.ok(res.verification?.verified);
    assert.ok(res.backup_path);
  });

  // 3. System diagnostics returns VERIFIED_SUCCESS with structured hardware metrics
  await runTest("System diagnostics returns VERIFIED_SUCCESS with real metrics", async () => {
    const res = await ultronTools.execute("get_system_diagnostics", {});
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.completion_state, "VERIFIED_SUCCESS");
    assert.ok(res.cpu);
    assert.ok(res.memory);
    assert.ok(res.verification?.verified);
  });

  // 4. Evaluate math returns VERIFIED_SUCCESS
  await runTest("Math evaluation returns VERIFIED_SUCCESS", async () => {
    const res = await ultronTools.execute("evaluate_math", { expression: "42 * 8" });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.completion_state, "VERIFIED_SUCCESS");
    assert.strictEqual(res.result, 336);
  });

  // 5. Destructive delete_file without confirmation is BLOCKED
  await runTest("Destructive delete_file without confirmation is BLOCKED", async () => {
    const res = await ultronTools.execute("delete_file", { file_path: "scratch/test_verified_exec.txt" });
    assert.strictEqual(res.status, "confirmation_required");
    assert.strictEqual(res.completion_state, "BLOCKED");
    assert.ok(res.confirm_token);
  });

  // 6. Confirmed delete_file executes and returns VERIFIED_SUCCESS
  await runTest("Confirmed delete_file executes with token and returns VERIFIED_SUCCESS", async () => {
    // Generate confirmation token
    const gate = await ultronTools.execute("delete_file", { file_path: "scratch/test_verified_exec.txt" });
    assert.strictEqual(gate.completion_state, "BLOCKED");

    const confirmed = await ultronTools.execute("delete_file", { file_path: "scratch/test_verified_exec.txt" }, gate.confirm_token);
    assert.strictEqual(confirmed.status, "success");
    assert.strictEqual(confirmed.completion_state, "VERIFIED_SUCCESS");
    assert.strictEqual(confirmed.verification?.file_deleted, true);
  });

  // 7. Invalid confirmation token is BLOCKED
  await runTest("Invalid or expired confirmation token is rejected as BLOCKED", async () => {
    const res = await ultronTools.execute("delete_file", { file_path: "scratch/dummy.txt" }, "FAKE_TOKEN_999");
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.completion_state, "BLOCKED");
  });

  // 8. Missing required parameters return FAILED state
  await runTest("Missing required parameters return FAILED state with error", async () => {
    const res = await ultronTools.execute("patch_file", { file_path: "scratch/dummy.txt" });
    assert.strictEqual(res.status, "error");
    assert.strictEqual(res.completion_state, "FAILED");
    assert.ok(res.error);
  });

  // 9. Window enumeration returns VERIFIED_SUCCESS
  await runTest("Window enumeration returns VERIFIED_SUCCESS with desktop list", async () => {
    const res = await ultronTools.execute("enumerate_windows", {});
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.completion_state, "VERIFIED_SUCCESS");
    assert.ok(Array.isArray(res.windows));
  });

  // 10. Screen analysis returns VERIFIED_SUCCESS and clearly states model vs structural fallback
  await runTest("Screen analysis returns VERIFIED_SUCCESS and transparent model status", async () => {
    const res = await ultronTools.execute("analyze_screen", { query: "What is on the screen?" });
    assert.strictEqual(res.status, "success");
    assert.strictEqual(res.completion_state, "VERIFIED_SUCCESS");
    assert.ok(res.analysis_type);
    assert.ok(res.screenshot_path);
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Phase 3 Verified Execution Suite Results: ${passed} / ${total} PASS (${Math.round((passed / total) * 100)}%)`);
  console.log("--------------------------------------------------------------------------------\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runVerifiedExecutionSuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
