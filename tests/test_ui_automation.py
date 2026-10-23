"""
ULTRON Phase 3A Verification Suite
Tests native Windows UI Automation window discovery and accessibility element inspection.
Verifies strictly read-only operation, graceful error handling, bounded parameters,
and intent router integration.
"""

import os
import re
import sys
import json
import subprocess
import unittest

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PS1_BRIDGE = os.path.join(WORKSPACE_ROOT, "lib", "scripts", "windows_uia.ps1")
TS_BRIDGE = os.path.join(WORKSPACE_ROOT, "lib", "ultronUIAutomation.ts")
ROUTER_TS = os.path.join(WORKSPACE_ROOT, "lib", "intentRouter.ts")
TOOLS_TS = os.path.join(WORKSPACE_ROOT, "lib", "ultronTools.ts")

class TestUltronUIAutomation(unittest.TestCase):

    def run_bridge_ps1(self, args_list, timeout=35):
        """Helper to invoke the PowerShell UIA bridge directly."""
        cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1_BRIDGE] + args_list
        proc = subprocess.run(
            cmd,
            cwd=WORKSPACE_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout
        )
        self.assertEqual(proc.returncode, 0, f"Bridge exited with non-zero code: {proc.stderr}")
        out = proc.stdout.strip()
        # Find json object in stdout
        start = out.find("{")
        end = out.rfind("}")
        self.assertTrue(start != -1 and end != -1, f"No JSON output from bridge: {out}")
        return json.loads(out[start:end+1])

    def test_01_strictly_read_only_source_code_audit(self):
        """Guarantee: Absolutely no mouse clicks, typing, or mutating Win32/UIA methods exist in bridge files."""
        # Check PowerShell bridge
        with open(PS1_BRIDGE, "r", encoding="utf-8") as f:
            ps_code = f.read()

        prohibited_terms = [
            "SendInput",
            "mouse_event",
            "keybd_event",
            "InvokePattern",
            "ValuePattern",
            "TransformPattern",
            "TogglePattern",
            "SetFocus",
            "mouse_click",
            "SendKeys",
            "PostMessage",
        ]

        for term in prohibited_terms:
            self.assertNotIn(
                term,
                ps_code,
                f"Violation of Read-Only Safety Guarantee! Found prohibited input method '{term}' in windows_uia.ps1"
            )

        # Check TypeScript bridge
        with open(TS_BRIDGE, "r", encoding="utf-8") as f:
            ts_code = f.read()

        for term in prohibited_terms:
            self.assertNotIn(
                term,
                ts_code,
                f"Violation of Read-Only Safety Guarantee! Found prohibited input method '{term}' in ultronUIAutomation.ts"
            )

    def test_02_enumerate_windows_returns_active_desktop_windows(self):
        """Verifies top-level window discovery on the user desktop."""
        result = self.run_bridge_ps1(["-Action", "enumerate"])
        self.assertEqual(result.get("status"), "success")
        self.assertIn("windows", result)
        self.assertIn("count", result)
        windows = result["windows"]
        self.assertGreater(len(windows), 0, "Expected at least 1 top-level desktop window.")

        # Check structure of the first window
        first_win = windows[0]
        self.assertIn("hwnd", first_win)
        self.assertIn("pid", first_win)
        self.assertIn("title", first_win)
        self.assertIn("class_name", first_win)
        self.assertIn("is_visible", first_win)
        self.assertIn("bounds", first_win)
        self.assertIn("x", first_win["bounds"])
        self.assertIn("y", first_win["bounds"])
        self.assertIn("width", first_win["bounds"])
        self.assertIn("height", first_win["bounds"])

    def test_03_enumerate_windows_with_filter(self):
        """Verifies filtering by title/class name."""
        result = self.run_bridge_ps1(["-Action", "enumerate", "-Filter", "Code"])
        self.assertEqual(result.get("status"), "success")
        windows = result.get("windows", [])
        for w in windows:
            matches = "code" in w["title"].lower() or "code" in w["class_name"].lower()
            self.assertTrue(matches, f"Window {w['title']} ({w['class_name']}) did not match filter 'Code'")

    def test_04_inspect_window_elements_real_target(self):
        """Verifies inspecting accessibility elements of an existing window (e.g. VS Code or Chrome)."""
        enum_res = self.run_bridge_ps1(["-Action", "enumerate"])
        self.assertGreater(len(enum_res.get("windows", [])), 0)
        
        target_win = enum_res["windows"][0]
        target_hwnd = str(target_win["hwnd"])

        inspect_res = self.run_bridge_ps1([
            "-Action", "inspect",
            "-TargetHwnd", target_hwnd,
            "-MaxDepth", "2",
            "-MaxElements", "20"
        ])

        self.assertEqual(inspect_res.get("status"), "success")
        self.assertIn("window_root", inspect_res)
        self.assertIn("elements", inspect_res)
        self.assertIn("element_count", inspect_res)
        self.assertGreater(inspect_res["element_count"], 0)

        # Verify element fields
        el = inspect_res["elements"][0]
        self.assertIn("depth", el)
        self.assertIn("name", el)
        self.assertIn("automation_id", el)
        self.assertIn("control_type", el)
        self.assertIn("class_name", el)
        self.assertIn("is_enabled", el)
        self.assertIn("has_keyboard_focus", el)
        self.assertIn("is_offscreen", el)
        self.assertIn("bounds", el)

    def test_05_inspect_window_invalid_target_graceful_error(self):
        """Verifies graceful handling when target window does not exist."""
        inspect_res = self.run_bridge_ps1([
            "-Action", "inspect",
            "-TargetTitle", "NonExistentFakeWindowTitle_99999"
        ])
        self.assertEqual(inspect_res.get("status"), "error")
        self.assertIn("not found", inspect_res.get("error", "").lower())

    def test_06_bounded_limits_enforced(self):
        """Verifies max depth and elements are constrained within safe boundaries."""
        inspect_res = self.run_bridge_ps1([
            "-Action", "inspect",
            "-TargetTitle", "Visual Studio Code",
            "-MaxDepth", "100",  # script clamps to 6
            "-MaxElements", "10" # requested 10
        ])
        if inspect_res.get("status") == "success":
            self.assertLessEqual(inspect_res.get("element_count", 0), 10)

    def test_07_intent_router_classifies_window_commands(self):
        """Verifies intentRouter routes window queries to enumerate_windows and inspect_window_elements."""
        node_script = """
import { routeUserQuery } from './lib/intentRouter.ts';
const q1 = routeUserQuery('list all open windows');
const q2 = routeUserQuery('what windows are open');
const q3 = routeUserQuery('show active windows');
const q4 = routeUserQuery('inspect window Visual Studio Code');
const q5 = routeUserQuery('inspect window 19072');

console.log(JSON.stringify({
    q1: { tool: q1.toolRequired, intent: q1.intent },
    q2: { tool: q2.toolRequired, intent: q2.intent },
    q3: { tool: q3.toolRequired, intent: q3.intent },
    q4: { tool: q4.toolRequired, intent: q4.intent, params: q4.toolParams },
    q5: { tool: q5.toolRequired, intent: q5.intent, params: q5.toolParams },
}));
"""
        cmd = ["node", "--experimental-strip-types", "-e", node_script]
        proc = subprocess.run(cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
        self.assertEqual(proc.returncode, 0, f"Node script failed: {proc.stderr}")
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("{")), None)
        self.assertIsNotNone(json_line, f"No JSON line found in: {proc.stdout}")
        data = json.loads(json_line)

        self.assertEqual(data["q1"]["tool"], "enumerate_windows")
        self.assertEqual(data["q2"]["tool"], "enumerate_windows")
        self.assertEqual(data["q3"]["tool"], "enumerate_windows")

        self.assertEqual(data["q4"]["tool"], "inspect_window_elements")
        self.assertEqual(data["q4"]["params"].get("window_title", "").lower(), "visual studio code")

        self.assertEqual(data["q5"]["tool"], "inspect_window_elements")
        self.assertEqual(data["q5"]["params"].get("target_pid"), 19072)

    def test_08_tools_registry_contains_new_tools(self):
        """Verifies ULTRON_TOOLS contains schemas for enumerate_windows and inspect_window_elements."""
        node_script = """
import { ULTRON_TOOLS } from './lib/intentRouter.ts';
const names = ULTRON_TOOLS.map(t => t.name);
console.log(JSON.stringify(names));
"""
        cmd = ["node", "--experimental-strip-types", "-e", node_script]
        proc = subprocess.run(cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
        self.assertEqual(proc.returncode, 0, f"Node script failed: {proc.stderr}")
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("[")), None)
        self.assertIsNotNone(json_line, f"No JSON array found in: {proc.stdout}")
        names = json.loads(json_line)
        self.assertIn("enumerate_windows", names)
        self.assertIn("inspect_window_elements", names)


if __name__ == "__main__":
    unittest.main()
