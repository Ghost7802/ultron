/**
 * ULTRON Master Reliability Upgrade: Phase 2 Memory Acceptance Test Suite
 * 
 * 10 Critical Acceptance Tests:
 * 1. QuantumX Namespace Boundary (rejection of unauthorized project namespaces)
 * 2. Sensitive Credential Defense (rejection of secrets/API keys/passwords)
 * 3. Exact & Normalized Deduplication (consolidation without duplicate ID generation)
 * 4. Evidence & Confidence Consolidation (merging evidence, picking max confidence)
 * 5. Decision Promotion Guardrail (unauthorized assistant inference promotion blocked)
 * 6. Authorized Decision Promotion (explicit user authorization permitted)
 * 7. Record Superseding (marking previous records as superseded with audit trail)
 * 8. Permanent Tombstoning (setting deletion_state='tombstone', redacting content)
 * 9. Active Memory Isolation (tombstones excluded from getRecords, getRecordById, summary)
 * 10. Persistence Integrity & Tombstone Audit (tombstones retained for audit via getTombstones)
 */

import assert from "assert";
import { QuantumXMemoryEngine } from "../lib/quantumxMemory";
import { ultronMemory } from "../lib/ultronMemory";

async function runMemoryReliabilitySuite() {
  console.log("================================================================================");
  console.log("   TEST SUITE: ULTRON PHASE 2 MEMORY RELIABILITY & INTEGRITY");
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

  // 1. QuantumX Namespace Boundary
  runTest("Rejects memory writes for unauthorized project namespaces", () => {
    assert.throws(
      () => {
        QuantumXMemoryEngine.saveRecord({
          project_id: "ProjectOmega",
          record_type: "fact",
          status: "approved",
          content: "Unauthorized project entry",
          source: "test",
        });
      },
      /QuantumX Memory Boundary Violation/,
      "Must throw boundary violation error"
    );
  });

  // 2. Sensitive Credential Defense
  runTest("Rejects sensitive credentials (API keys, secrets, private keys)", () => {
    assert.throws(
      () => {
        QuantumXMemoryEngine.saveRecord({
          project_id: "QuantumX",
          record_type: "fact",
          status: "approved",
          content: "Database password is supersecretpassword123!",
          source: "test",
        });
      },
      /Security Violation/,
      "Must reject sensitive credentials"
    );

    assert.throws(
      () => {
        QuantumXMemoryEngine.saveRecord({
          project_id: "QuantumX",
          record_type: "fact",
          status: "approved",
          content: "Service key is sk-1234567890abcdef",
          source: "test",
        });
      },
      /Security Violation/,
      "Must reject openai-style secret keys"
    );
  });

  // 3. Exact & Normalized Deduplication
  runTest("Consolidates identical normalized content rather than creating duplicate IDs", () => {
    const testContent = "QuantumX uses local-first architecture for latency optimization.";
    const rec1 = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "fact",
      status: "approved",
      content: testContent,
      source: "user_briefing_1",
      confidence: 0.8,
    });

    assert.ok(rec1.record_id, "Record 1 must have an ID");

    // Second write with slightly different casing/whitespace
    const rec2 = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "fact",
      status: "approved",
      content: "  QuantumX uses local-first architecture for latency optimization.   ",
      source: "user_briefing_2",
      confidence: 0.95,
      evidence: "Verified in local benchmarking tests.",
    });

    assert.strictEqual(rec2.record_id, rec1.record_id, "Record ID must be preserved during consolidation");
    assert.strictEqual(rec2.wasConsolidated, true, "Record must be flagged as consolidated");
  });

  // 4. Evidence & Confidence Consolidation
  runTest("Consolidates confidence to maximum and merges evidence strings", () => {
    const testContent = "QuantumX engine uses persistent SQLite/JSON backing store.";
    const rec1 = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "fact",
      status: "approved",
      content: testContent,
      source: "initial_spec",
      evidence: "Evidence A: Initial design doc",
      confidence: 0.7,
    });

    const rec2 = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "fact",
      status: "approved",
      content: testContent,
      source: "secondary_spec",
      evidence: "Evidence B: Benchmarked storage layer",
      confidence: 0.92,
    });

    assert.strictEqual(rec2.confidence, 0.92, "Confidence must be updated to maximum");
    assert.ok(rec2.evidence?.includes("Evidence A"), "Must retain Evidence A");
    assert.ok(rec2.evidence?.includes("Evidence B"), "Must include Evidence B");
  });

  // 5. Decision Promotion Guardrail (Unverified assistant inference rejected)
  runTest("Rejects unverified assistant suggestions from being silently saved as approved decisions", () => {
    assert.throws(
      () => {
        QuantumXMemoryEngine.saveRecord({
          project_id: "QuantumX",
          record_type: "decision",
          status: "approved",
          content: "Switch QuantumX entirely to microservice architecture.",
          source: "assistant_suggestion",
        });
      },
      /Decision Promotion Violation/,
      "Must throw Decision Promotion Violation when assistant tries to approve a decision without user authorization"
    );
  });

  // 6. Authorized Decision Promotion
  runTest("Allows approved decision when explicit user authorization is provided", () => {
    const dec = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "decision",
      status: "approved",
      content: "Adopt TypeScript for all core QuantumX modules.",
      source: "user_instruction",
      evidence: "User explicitly stated in session: 'We will use TypeScript exclusively'",
      confidence: 1.0,
    });

    assert.strictEqual(dec.status, "approved");
    assert.strictEqual(dec.record_type, "decision");
    assert.ok(dec.record_id);
  });

  // 7. Record Superseding
  runTest("Marks prior record as superseded when supersedes_record_id is supplied", () => {
    const original = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "hypothesis",
      status: "proposed",
      content: "QuantumX will use HTTP REST for all inter-process comms.",
      source: "initial_draft",
    });

    const superseding = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "decision",
      status: "approved",
      content: "QuantumX will use local IPC for inter-process comms.",
      source: "user_instruction",
      evidence: "user_approved in architecture review",
      supersedes_record_id: original.record_id,
    });

    assert.ok(superseding.record_id);
    const priorCheck = QuantumXMemoryEngine.getRecords().find((r) => r.record_id === original.record_id);
    assert.strictEqual(priorCheck?.status, "superseded", "Prior record must be marked superseded");
  });

  // 8. Permanent Tombstoning
  runTest("Deletes record via permanent tombstoning with content redaction", () => {
    const toDelete = QuantumXMemoryEngine.saveRecord({
      project_id: "QuantumX",
      record_type: "task",
      status: "in_progress",
      content: "Temporary scratch task to be purged.",
      source: "unit_test",
    });

    const deleted = QuantumXMemoryEngine.deleteRecord(toDelete.record_id);
    assert.strictEqual(deleted, true, "deleteRecord must return true");

    const queryActive = QuantumXMemoryEngine.getRecordById(toDelete.record_id);
    assert.strictEqual(queryActive, null, "Active lookup must return null for tombstoned record");
  });

  // 9. Active Memory Isolation
  runTest("Active queries and summary never return tombstoned records", () => {
    const allActive = QuantumXMemoryEngine.getRecords();
    const hasTombstone = allActive.some((r) => r.deletion_state === "tombstone" || r.content === "[DELETED_BY_USER]");
    assert.strictEqual(hasTombstone, false, "Active records must contain 0 tombstones");

    const summary = QuantumXMemoryEngine.getQuantumXContextSummary();
    assert.strictEqual(summary.includes("[DELETED_BY_USER]"), false, "Summary must never include deleted records");
    assert.strictEqual(summary.includes("Temporary scratch task"), false, "Summary must never include purged task");
  });

  // 10. Persistence Integrity & Tombstone Audit
  runTest("Tombstoned records remain identifiable on disk via getTombstones() for audit compliance", () => {
    const tombstones = QuantumXMemoryEngine.getTombstones();
    assert.ok(tombstones.length > 0, "At least one tombstone must be preserved on disk for audit trail");
    const sample = tombstones[0];
    assert.strictEqual(sample.deletion_state, "tombstone");
    assert.strictEqual(sample.content, "[DELETED_BY_USER]");
    assert.strictEqual(sample.project_id, "QuantumX");
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Phase 2 Memory Suite Results: ${passed} / ${total} PASS (${Math.round((passed / total) * 100)}%)`);
  console.log("--------------------------------------------------------------------------------\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runMemoryReliabilitySuite().catch((err) => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
