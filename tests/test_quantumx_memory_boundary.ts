/**
 * Automated Verification Suite: QuantumX Project Memory Boundary & Scope Enforcement
 * 
 * Tests:
 * 1. Save valid QuantumX fact -> SUCCESS
 * 2. Ambiguous record without valid project_id -> QUARANTINED into inbox store
 * 3. Unrelated project namespace write -> STRICT REJECTION with boundary error
 * 4. Retrieve QuantumX records -> returns ONLY QuantumX active records
 * 5. Update/correct record -> verified content updated, history preserved
 * 6. Tombstone permanent deletion -> record marked tombstone, never resurrected
 * 7. Persistence across memory reload -> reloaded from disk accurately
 * 8. Sensitive credential rejection -> API keys, passwords blocked from memory
 * 9. Separation of ULTRON internal operational context from QuantumX project memory
 */

import assert from "assert";
import { QuantumXMemoryEngine, type QuantumXMemoryRecord } from "../lib/quantumxMemory";
import { ultronMemory } from "../lib/ultronMemory";
import { ProjectContextManager } from "../lib/projectContext";

async function runQuantumXMemoryBoundaryTests() {
  console.log("================================================================================");
  console.log("   TEST SUITE: QUANTUMX MEMORY BOUNDARY & SCOPE ENFORCEMENT");
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

  // 1. Save valid QuantumX record
  runTest("Save valid QuantumX fact with required schema", () => {
    const rec = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_id: "QX-TEST-001",
      record_type: "fact",
      status: "approved",
      content: "QuantumX supports declarative task pipelines for multi-agent workflows.",
      source: "engineering_spec",
      evidence: "Verified against core architecture doc",
      confidence: 0.95,
    });

    assert.strictEqual(rec.project_id, "QuantumX");
    assert.strictEqual(rec.record_id, "QX-TEST-001");
    assert.strictEqual(rec.deletion_state, "active");
    assert.strictEqual(rec.status, "approved");
    assert.strictEqual(rec.confidence, 0.95);
  });

  // 2. Reject and quarantine ambiguous record missing project_id
  runTest("Ambiguous record missing project_id is quarantined to inbox", () => {
    let threw = false;
    try {
      QuantumXMemoryEngine.saveRecord({
        project_id: "" as any,
        record_type: "fact",
        status: "proposed",
        content: "Ambiguous notes from meeting",
        source: "unknown",
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes("Boundary Violation"), "Error must cite Boundary Violation");
    }
    assert.strictEqual(threw, true, "Must throw on missing project_id");

    // Check inbox store for quarantined entry
    const inboxItems = ultronMemory.getInboxItems();
    const hasQuarantine = inboxItems.some((f) => f.key.startsWith("quarantine_") && f.value.includes("Ambiguous notes"));
    assert.strictEqual(hasQuarantine, true, "Record must be quarantined in candidate facts inbox");
  });

  // 3. Strict rejection of unrelated project namespace
  runTest("Unrelated project write (AlphaProject) is strictly rejected", () => {
    let threw = false;
    let errorMsg = "";
    try {
      QuantumXMemoryEngine.saveRecord({
        project_id: "AlphaProject" as any,
        record_id: "ALPHA-001",
        record_type: "fact",
        status: "approved",
        content: "AlphaProject uses Postgres and Django.",
        source: "user_query",
      });
    } catch (err: any) {
      threw = true;
      errorMsg = err.message;
    }

    assert.strictEqual(threw, true, "Must reject unrelated project write");
    assert(
      errorMsg.includes("Only 'QuantumX' is permitted in user project memory"),
      `Unexpected error message: ${errorMsg}`
    );

    // Verify AlphaProject was NOT written to project facts
    const facts = ultronMemory.getProjectFacts();
    const leaked = facts.some((f) => f.value.includes("AlphaProject uses Postgres"));
    assert.strictEqual(leaked, false, "Unrelated project data must not leak into storage");
  });

  // 4. Retrieve QuantumX records - only active QuantumX records returned
  runTest("Retrieve active QuantumX records with filtering", () => {
    const all = QuantumXMemoryEngine.getRecords();
    assert(all.length >= 1, "Must contain at least the test record or seeds");
    for (const r of all) {
      assert.strictEqual(r.project_id, "QuantumX", "Every returned record must have project_id QuantumX");
      assert.strictEqual(r.deletion_state, "active", "Every returned record must be active");
    }

    const factsOnly = QuantumXMemoryEngine.getRecords({ record_type: "fact" });
    assert(factsOnly.every((r) => r.record_type === "fact"), "Filter must respect record_type");
  });

  // 5. Update/correct record with new verified content
  runTest("Correct record content and preserve evidence", () => {
    const updated = QuantumXMemoryEngine.correctRecord(
      "QX-TEST-001",
      "QuantumX supports declarative task pipelines with automated DAG validation.",
      "Verified in PR #42 test suite"
    );
    assert.strictEqual(updated, true, "correctRecord must return true");

    const fetched = QuantumXMemoryEngine.getRecordById("QX-TEST-001");
    assert.ok(fetched, "Record must exist");
    assert.strictEqual(fetched?.content, "QuantumX supports declarative task pipelines with automated DAG validation.");
    assert.strictEqual(fetched?.evidence, "Verified in PR #42 test suite");
  });

  // 6. Tombstone permanent deletion
  runTest("Tombstone deletion prevents resurrection across rebuilds and queries", () => {
    // Create temporary record to delete
    QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_id: "QX-TODELETE-001",
      record_type: "task",
      status: "in_progress",
      content: "Temporary scratch task to be removed",
      source: "temp",
    });

    // Verify it exists
    assert.ok(QuantumXMemoryEngine.getRecordById("QX-TODELETE-001"), "Record must exist before deletion");

    // Perform tombstone deletion
    const deleted = QuantumXMemoryEngine.deleteRecord("QX-TODELETE-001");
    assert.strictEqual(deleted, true, "deleteRecord must return true");

    // Verify getRecordById returns null
    const afterDelete = QuantumXMemoryEngine.getRecordById("QX-TODELETE-001");
    assert.strictEqual(afterDelete, null, "Deleted record must not be returned by getRecordById");

    // Verify getRecords never returns it
    const activeRecords = QuantumXMemoryEngine.getRecords();
    const foundInActive = activeRecords.some((r) => r.record_id === "QX-TODELETE-001");
    assert.strictEqual(foundInActive, false, "Deleted record must never appear in active getRecords()");

    // Verify context summary does not contain deleted text
    const summary = QuantumXMemoryEngine.getQuantumXContextSummary();
    assert(!summary.includes("Temporary scratch task"), "Deleted record must not appear in context summary");
  });

  // 7. Sensitive credential protection
  runTest("Block credentials, API keys, and passwords from persistent project memory", () => {
    let threwKey = false;
    try {
      QuantumXMemoryEngine.saveRecord({
        project_id: "QuantumX",
        record_type: "fact",
        status: "proposed",
        content: "API_KEY=sk-proj-1234567890abcdef1234567890",
        source: "user_leak",
      });
    } catch (err: any) {
      threwKey = true;
      assert(err.message.includes("Security Violation"), "Must cite Security Violation");
    }
    assert.strictEqual(threwKey, true, "Must block raw API keys");

    let threwPasswd = false;
    try {
      QuantumXMemoryEngine.saveRecord({
        project_id: "QuantumX",
        record_type: "fact",
        status: "proposed",
        content: "Production database password: SuperSecretPassword123!",
        source: "user_leak",
      });
    } catch (err: any) {
      threwPasswd = true;
    }
    assert.strictEqual(threwPasswd, true, "Must block raw passwords");
  });

  // 8. Dual-scope isolation: ULTRON operational diagnostics separated from QuantumX
  runTest("ULTRON internal decisions are distinct from QuantumX context", () => {
    const qxContext = ProjectContextManager.getQuantumXContext();
    assert.strictEqual(qxContext.projectId, "QuantumX");

    const ultronDecisions = ProjectContextManager.getUltronInternalDecisions();
    assert(ultronDecisions.length >= 4, "Must contain ULTRON operational decisions");
    assert(
      ultronDecisions.some((d) => d.id === "ULTRON-DEC-001"),
      "Must contain ULTRON-DEC-001 local-first rule"
    );

    // Verify ULTRON-DEC-001 does NOT apply to QuantumX cloud inquiries
    const conflictCheck = ProjectContextManager.detectDecisionConflict("Should we integrate OpenAI API in QuantumX?");
    assert.strictEqual(
      conflictCheck.hasConflict,
      false,
      "QuantumX inquiry must NOT trigger ULTRON-DEC-001 conflict"
    );

    // Verify ULTRON host inquiry DOES apply ULTRON-DEC-001
    const hostCheck = ProjectContextManager.detectDecisionConflict("Connect ULTRON assistant to OpenAI API");
    assert.strictEqual(
      hostCheck.hasConflict,
      true,
      "ULTRON assistant inquiry must trigger ULTRON-DEC-001 conflict"
    );
  });

  // 9. Persistence across memory reload
  runTest("Memory persistence across reload cycle", () => {
    // Force disk reload of ultronMemory
    ultronMemory.reload();

    const record = QuantumXMemoryEngine.getRecordById("QX-TEST-001");
    assert.ok(record, "Record QX-TEST-001 must persist across memory reload");
    assert.strictEqual(
      record?.content,
      "QuantumX supports declarative task pipelines with automated DAG validation."
    );
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runQuantumXMemoryBoundaryTests();
