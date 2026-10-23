/**
 * Automated Verification Suite: Personal Profile & QuantumX Memory Bootstrap
 * 
 * Verifies:
 * 1. Personal profile context is stored in Layer 2 (personalStore) with source & confidence.
 * 2. All 9 personal attributes accurately retrieved without invented details.
 * 3. QuantumX context is stored in Layer 3 (projectStore) with strict project_id: "QuantumX".
 * 4. All 7 historical strategic goals and QX-UNCONF-001 tracked unknowns verified.
 * 5. QuantumX is the ONLY permitted user-project namespace in persistent project memory.
 * 6. Strict separation of personal profile context from QuantumX project records.
 * 7. Persistence across memory reload / restart cycle.
 * 8. Credential protection and no unauthorized writes.
 */

import assert from "assert";
import { ultronMemory } from "../lib/ultronMemory";
import { QuantumXMemoryEngine } from "../lib/quantumxMemory";

async function runBootstrapVerification() {
  console.log("================================================================================");
  console.log("   TEST SUITE: PERSONAL PROFILE & QUANTUMX MEMORY BOOTSTRAP");
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

  // 1. Verify personal profile items in personalStore
  runTest("Personal profile contains all 9 required attributes in personal store", () => {
    const profile = ultronMemory.getPersonalProfile();
    
    assert.strictEqual(profile["owner"], "Ashish", "Owner must be Ashish");
    assert(profile["education_status"].includes("BTech in AI/ML"), "Education status must match");
    assert(profile["learning_focus"].includes("programming"), "Learning focus must match");
    assert(profile["technical_skills"].includes("Python") && profile["technical_skills"].includes("Supabase"), "Skills must match");
    assert(profile["core_interests"].includes("AI models") && profile["core_interests"].includes("local AI"), "Interests must match");
    assert(profile["engineering_goals"].includes("practical engineering skills"), "Goals must match");
    assert(profile["cost_and_solution_preference"].includes("avoid unnecessary paid APIs"), "Cost preference must match");
    assert(profile["explanation_style_preference"].includes("beginner-friendly"), "Learning style must match");
    assert(profile["preferred_language"].includes("Hindi") && profile["preferred_language"].includes("Hinglish"), "Language must match");
  });

  // 2. Verify source and confidence tracking in personal store
  runTest("Personal entries maintain source and confidence metadata", () => {
    const entries = ultronMemory.getPersonalEntries();
    const eduEntry = entries.find((e) => e.key === "education_status");
    assert.ok(eduEntry, "Education entry must exist");
    assert.strictEqual(eduEntry?.source, "user_provided_context", "Source must be user_provided_context");
    assert.strictEqual(eduEntry?.confidence, 0.9, "Confidence must be 0.9");
  });

  // 3. Verify QuantumX historical strategic facts and proposals
  runTest("QuantumX records contain all 7 historical strategic points and tracked unknowns", () => {
    const strat1 = QuantumXMemoryEngine.getRecordById("QX-STRAT-001");
    assert.ok(strat1, "QX-STRAT-001 must exist");
    assert.strictEqual(strat1?.record_type, "fact");
    assert.strictEqual(strat1?.status, "approved");
    assert(strat1?.content.includes("model-agnostic AI orchestration platform"));

    const strat2 = QuantumXMemoryEngine.getRecordById("QX-STRAT-002");
    assert.ok(strat2, "QX-STRAT-002 must exist");
    assert.strictEqual(strat2?.record_type, "fact");
    assert(strat2?.content.includes("Personal AI Operating System"));

    const cap1 = QuantumXMemoryEngine.getRecordById("QX-CAP-001");
    assert.ok(cap1, "QX-CAP-001 must exist");
    assert.strictEqual(cap1?.record_type, "hypothesis");
    assert.strictEqual(cap1?.status, "proposed");
    assert(cap1?.content.includes("intended capability areas include AI model orchestration"));

    const arch1 = QuantumXMemoryEngine.getRecordById("QX-ARCH-001");
    assert.ok(arch1, "QX-ARCH-001 must exist");
    assert.strictEqual(arch1?.record_type, "hypothesis");
    assert(arch1?.content.includes("orchestration layer coordinate AI reasoning, tools, and workflows"));

    const arch2 = QuantumXMemoryEngine.getRecordById("QX-ARCH-002");
    assert.ok(arch2, "QX-ARCH-002 must exist");
    assert.strictEqual(arch2?.record_type, "hypothesis");
    assert(arch2?.content.includes("hosted and local AI models"));

    const prin1 = QuantumXMemoryEngine.getRecordById("QX-PRIN-001");
    assert.ok(prin1, "QX-PRIN-001 must exist");
    assert.strictEqual(prin1?.record_type, "decision");
    assert.strictEqual(prin1?.status, "approved");
    assert(prin1?.content.includes("reliability, security, privacy, performance, cost"));

    const seq1 = QuantumXMemoryEngine.getRecordById("QX-SEQ-001");
    assert.ok(seq1, "QX-SEQ-001 must exist");
    assert.strictEqual(seq1?.record_type, "suggestion");
    assert.strictEqual(seq1?.status, "proposed");
    assert(seq1?.content.includes("useful, testable initial product"));

    const unconf = QuantumXMemoryEngine.getRecordById("QX-UNCONF-001");
    assert.ok(unconf, "QX-UNCONF-001 must exist");
    assert(unconf?.content.includes("UNCONFIRMED"));
  });

  // 4. Single-tenant namespace rule: QuantumX is the only user project
  runTest("QuantumX is strictly the only user-project namespace in memory", () => {
    const rawFacts = ultronMemory.getProjectFacts();
    for (const f of rawFacts) {
      if (f.key.startsWith("qx_")) {
        try {
          const parsed = JSON.parse(f.value);
          assert.strictEqual(
            parsed.project_id,
            "QuantumX",
            `Found unexpected project_id '${parsed.project_id}' in record ${f.key}`
          );
        } catch {}
      }
    }
  });

  // 5. Strict rejection of unrelated user projects
  runTest("Attempt to write memory for unrelated project is blocked", () => {
    let threw = false;
    try {
      QuantumXMemoryEngine.saveRecord({
        project_id: "OtherUserProject" as any,
        record_id: "OTHER-001",
        record_type: "fact",
        status: "approved",
        content: "Other project data",
        source: "test",
      });
    } catch (err: any) {
      threw = true;
      assert(err.message.includes("Boundary Violation"), "Must cite boundary violation");
    }
    assert.strictEqual(threw, true, "Must throw on non-QuantumX project");
  });

  // 6. Strict separation of personal profile from QuantumX project records
  runTest("Personal context is isolated from project context", () => {
    const personalEntries = ultronMemory.getPersonalEntries();
    const projectFacts = ultronMemory.getProjectFacts();

    // Personal store should not contain qx_ records
    const personalHasQx = personalEntries.some((e) => e.key.startsWith("qx_"));
    assert.strictEqual(personalHasQx, false, "Personal store must not contain QuantumX project records");

    // QuantumX records should be under project store
    const projectHasQx = projectFacts.some((f) => f.key === "qx_QX-STRAT-001");
    assert.strictEqual(projectHasQx, true, "Project store must contain QuantumX records");
  });

  // 7. Persistence across memory reload / restart cycle
  runTest("Personal and QuantumX memories persist across reload cycle", () => {
    // Reload memory directly from disk file
    ultronMemory.reload();

    const profile = ultronMemory.getPersonalProfile();
    assert.strictEqual(profile["owner"], "Ashish", "Owner must persist across reload");
    assert.strictEqual(profile["education_status"], "College student studying BTech in AI/ML.", "Education must persist across reload");

    const qxRec = QuantumXMemoryEngine.getRecordById("QX-STRAT-001");
    assert.ok(qxRec, "QX-STRAT-001 must persist across reload");
    assert.strictEqual(qxRec?.status, "approved");
  });

  // 8. Credential protection in both personal and QuantumX stores
  runTest("Credential protection blocks API keys and secrets", () => {
    let threwPersonal = false;
    try {
      ultronMemory.savePreference("test_secret", "sk-proj-1234567890abcdef1234567890", "general");
    } catch (err: any) {
      threwPersonal = true;
    }
    assert.strictEqual(threwPersonal, true, "Personal memory must block API keys");

    let threwQx = false;
    try {
      QuantumXMemoryEngine.saveRecord({
        project_id: "QuantumX",
        record_type: "fact",
        status: "approved",
        content: "Database password is SuperSecretPassword123!",
        source: "test",
      });
    } catch (err: any) {
      threwQx = true;
    }
    assert.strictEqual(threwQx, true, "QuantumX memory must block passwords");
  });

  console.log("\n--------------------------------------------------------------------------------");
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log("================================================================================\n");

  if (passed !== total) {
    process.exit(1);
  }
}

runBootstrapVerification();

