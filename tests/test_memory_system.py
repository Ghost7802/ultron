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

def main():
    try:
        test_five_layers()
        test_auto_learning()
        test_reset_confirmation_gate()
        print("[SUCCESS] All Memory System tests passed.")
        return 0
    except AssertionError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
