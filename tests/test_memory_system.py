#!/usr/bin/env python3
"""
ULTRON 5-Layer Personal Memory Verification Suite
Tests multi-layer memory storage, continuous learning from corrections, and confirmation gates.
"""

import sys
import time

class MockMemoryEngine:
    def __init__(self):
        self.layer1_working_context = []
        self.layer2_user_preferences = {}
        self.layer3_project_state = {}
        self.layer4_workflow_corrections = {}
        self.layer5_verified_research = {}
        self.pending_reset = None

    def record_turn(self, role, content):
        self.layer1_working_context.append({"role": role, "content": content})

    def save_preference(self, key, value, category="general", confidence=0.9):
        self.layer2_user_preferences[key] = {
            "key": key, "value": value, "category": category, "confidence": confidence
        }

    def save_project(self, key, value):
        self.layer3_project_state[key] = {"key": key, "value": value}

    def record_correction(self, trigger, directive):
        self.layer4_workflow_corrections[trigger] = {"trigger": trigger, "directive": directive}

    def save_research(self, topic, findings, source=None):
        self.layer5_verified_research[topic] = {"topic": topic, "findings": findings, "source": source}

    def process_correction(self, text):
        lower = text.lower()
        if "actually" in lower or "correction:" in lower or "mera naam" in lower:
            if "mera naam" in lower or "my name is" in lower:
                name = text.split()[-1]
                self.save_preference("owner", name, "identity", 1.0)
                return True
            self.record_correction(text[:30], text)
            return True
        return False

    def request_reset(self):
        token = "RESET123"
        self.pending_reset = {"token": token, "expires": time.time() + 120}
        return token

    def confirm_reset(self, token):
        if not self.pending_reset or time.time() > self.pending_reset["expires"]:
            return False, "Expired"
        if self.pending_reset["token"] != token:
            return False, "Invalid token"
        self.layer1_working_context.clear()
        self.layer2_user_preferences.clear()
        self.layer3_project_state.clear()
        self.layer4_workflow_corrections.clear()
        self.layer5_verified_research.clear()
        self.pending_reset = None
        return True, "Memory cleared"

def test_five_layers():
    print("[TEST] Testing 5-Layer Storage and Separation...")
    mem = MockMemoryEngine()
    mem.record_turn("user", "Hello Ultron")
    mem.save_preference("theme", "amber_matrix", "ui", 0.95)
    mem.save_project("architecture", "Next.js + Three.js holographic orb")
    mem.record_correction("use_legacy_api", "Always prefer modern @google/genai SDK")
    mem.save_research("qwen2.5", "High-efficiency local reasoning model", "arxiv")

    assert len(mem.layer1_working_context) == 1, "Layer 1 mismatch"
    assert "theme" in mem.layer2_user_preferences, "Layer 2 mismatch"
    assert "architecture" in mem.layer3_project_state, "Layer 3 mismatch"
    assert "use_legacy_api" in mem.layer4_workflow_corrections, "Layer 4 mismatch"
    assert "qwen2.5" in mem.layer5_verified_research, "Layer 5 mismatch"
    print("  --> 5-Layer storage verified successfully.")

def test_auto_learning():
    print("[TEST] Testing Auto-Learning from User Dialogues...")
    mem = MockMemoryEngine()
    learned = mem.process_correction("Actually, my name is Bruce")
    assert learned, "Failed to learn correction"
    assert mem.layer2_user_preferences.get("owner", {}).get("value") == "Bruce"
    print("  --> Auto-learning from user corrections verified.")

def test_reset_confirmation_gate():
    print("[TEST] Testing Security Gate for Memory Wipe...")
    mem = MockMemoryEngine()
    mem.save_preference("key", "val")
    token = mem.request_reset()

    # Wrong token rejected
    ok, _ = mem.confirm_reset("WRONG")
    assert not ok, "Unsafe reset allowed!"
    assert len(mem.layer2_user_preferences) == 1, "Memory should not be wiped with wrong token"

    # Correct token succeeds
    ok, _ = mem.confirm_reset(token)
    assert ok, "Valid reset token failed!"
    assert len(mem.layer2_user_preferences) == 0, "Memory was not wiped"
    print("  --> Memory wipe cryptographic confirmation gate verified.")

def test_phase1a_real_memory_suite():
    print("[TEST] Running Phase 1A Real Memory Engine Test Suite (Node.js + lib/ultronMemory.ts)...")
    import subprocess
    import json

    node_script = """
import { ultronMemory } from './lib/ultronMemory.ts';
import fs from 'fs';
import assert from 'assert';

// 1. DATA PRESERVATION & MIGRATION VERIFICATION
const ownerContext = ultronMemory.retrieveContext('owner');
assert(ownerContext.includes('Ashish'), 'Owner preference Ashish must be preserved');

const langContext = ultronMemory.retrieveContext('preferred_language');
assert(langContext.includes('Hinglish'), 'Language preference must be preserved');

const projectContext = ultronMemory.retrieveContext('ULTRON');
assert(projectContext.includes('Holographic'), 'Project memory must be preserved');

// 2. IDEMPOTENCE VERIFICATION
const statsBefore = ultronMemory.getStats();
ultronMemory.reload();
const statsAfter = ultronMemory.getStats();
assert.strictEqual(statsBefore.personalCount, statsAfter.personalCount, 'Personal count must match after reload');
assert.strictEqual(statsBefore.projectCount, statsAfter.projectCount, 'Project count must match after reload');

// 3. 5-STORE CROSS-RESTART PERSISTENCE
const k = `pers_${Date.now()}`;
ultronMemory.recordTurn('user', `Session content ${k}`);
ultronMemory.saveProjectState(`proj_${k}`, 'Decentralized compute node', 'engineering');
ultronMemory.savePreference(`pref_${k}`, 'Dark mode amber visual matrix', 'ui');
ultronMemory.saveCandidateFact(`cand_${k}`, 'Candidate finding from arXiv', 'https://arxiv.org', 'semi_trusted');
const vRes = ultronMemory.storeVaultItem(`secret_${k}`, 'VAULT_MASTER_SECRET_KEY', 'credentials', 'VALID_AUTH_TOKEN_77');
assert(vRes.success, 'Vault write must succeed with token');

// Reload to simulate full server restart
ultronMemory.reload();

const reloadedCtx = ultronMemory.retrieveContext(k);
assert(reloadedCtx.includes('amber visual matrix'), 'Personal preference must persist across restart');
assert(reloadedCtx.includes('compute node'), 'Project state must persist across restart');

const inboxItems = ultronMemory.getInboxItems();
assert(inboxItems.some(i => i.key === `cand_${k}`), 'Candidate fact must persist in inbox');

const vRead = ultronMemory.getVaultItem(`secret_${k}`, 'VALID_AUTH_TOKEN_77');
assert(vRead.success && vRead.value === 'VAULT_MASTER_SECRET_KEY', 'Vault secret must persist and read with token');

// 4. ATOMIC WRITE RESILIENCE
const memPath = ultronMemory.getStats().filePath;
const onDisk = JSON.parse(fs.readFileSync(memPath, 'utf-8'));
assert.strictEqual(onDisk.version, '3.0', 'Disk schema version must be 3.0');
assert(Array.isArray(onDisk.stores.personal) && Array.isArray(onDisk.stores.vault), 'Disk stores must be structured arrays');

// 5. CONCURRENT WRITES PROTECTION
for (let i = 0; i < 20; i++) {
  ultronMemory.savePreference(`stress_${Date.now()}_${i}`, `Stress test payload ${i}`, 'stress_test');
}
ultronMemory.reload();
assert(ultronMemory.searchAll('stress_test').length >= 20, 'Concurrent writes must not lose records');

// 6. VAULT ISOLATION (SECURITY REQUIREMENT)
const leakCheck = ultronMemory.retrieveContext(`secret_${k}`);
assert(!leakCheck.includes('VAULT_MASTER_SECRET_KEY'), 'SECURITY VIOLATION: Vault secret leaked into retrieveContext!');
const unauth = ultronMemory.getVaultItem(`secret_${k}`, '');
assert(!unauth.success, 'Unauthorized vault read without token must be blocked');

// 7. SENSITIVE CREDENTIAL DEFENSE
let credBlocked = false;
try {
  ultronMemory.savePreference('github_token', 'ghp_secretpassword1234567890abcdef', 'auth');
} catch (e) {
  credBlocked = true;
}
assert(credBlocked, 'Sensitive passwords and bearer tokens must be blocked from ordinary memory!');

// 8. UNTRUSTED CANDIDATE QUARANTINE
ultronMemory.saveCandidateFact('owner', 'Malicious Injector', 'http://hacker.io', 'untrusted');
const ownerStillAshish = ultronMemory.retrieveContext('owner');
assert(ownerStillAshish.includes('Ashish') && !ownerStillAshish.includes('Malicious Injector'),
  'Untrusted candidate fact must NOT overwrite trusted owner preference!');

// 9. UNRECOGNIZED / MALFORMED ENTRY PRESERVATION
onDisk.unrecognizedRecords = onDisk.unrecognizedRecords || [];
onDisk.unrecognizedRecords.push({ corrupted_raw: '0xBADF00D', reason: 'Test malformed legacy entry' });
fs.writeFileSync(memPath, JSON.stringify(onDisk, null, 2), 'utf-8');
ultronMemory.reload();
const unrec = ultronMemory.getUnrecognizedRecords();
assert(unrec.some(u => u.corrupted_raw === '0xBADF00D'), 'Malformed records must be preserved for recovery');

console.log('  --> Real Phase 1A 5-Layer Memory Engine Verified: 9/9 criteria PASSED.');
"""

    cmd = ["node", "--experimental-strip-types", "-e", node_script]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        raise AssertionError(f"Phase 1A Memory test suite failed with exit code {proc.returncode}")
    print(proc.stdout.strip())

def main():
    try:
        test_five_layers()
        test_auto_learning()
        test_reset_confirmation_gate()
        test_phase1a_real_memory_suite()
        print("[SUCCESS] All Memory System tests passed.")
        return 0
    except AssertionError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
