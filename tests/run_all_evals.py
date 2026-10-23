#!/usr/bin/env python3
"""
ULTRON Master Integration Regression Suite
Executes all regression tests and asserts 100% test pass rate.
"""

import sys
import subprocess
from pathlib import Path

TESTS = [
    "tests/test_router.py",
    "tests/test_memory_system.py",
    "tests/test_computer_control.py",
    "tests/test_agent_planner.py",
    "tests/test_ui_automation.py",
    "tests/test_desktop_control.py",
    "tests/test_voice_browser_vision.py",
    "tests/test_hallucination.py",
    "tests/test_tool_calling.py",
]

def main():
    print("=" * 64)
    print("  ULTRON SMART BRAIN & PERSONAL OS REGRESSION SUITE")
    print("=" * 64)

    total = len(TESTS)
    passed = 0

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    for test_path in TESTS:
        print(f"\n>> Executing: {test_path}")
        result = subprocess.run([sys.executable, test_path], capture_output=True, text=True, encoding="utf-8", errors="replace")
        print(result.stdout, end="")
        if result.returncode != 0:
            print(result.stderr, file=sys.stderr)
            print(f"[FAIL] FAILED: {test_path}")
        else:
            print(f"[PASS] PASSED: {test_path}")
            passed += 1

    print("\n" + "=" * 64)
    print(f"  TEST SUMMARY: {passed}/{total} test suites PASSED")
    print("=" * 64)

    if passed == total:
        print("\n[ALL TESTS PASSED] The upgrade satisfies all backend and verification criteria.")
        return 0
    else:
        print("\n[REGRESSION ERROR] One or more test suites failed.", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
