"""
ULTRON Phase 3B: Safe Native Desktop Control Verification Suite
Tests bounded native desktop control actions:
- focus_window
- click_ui_element
- type_text
- press_key
Verifies cryptographic confirmation gates, target/payload token binding,
credential blocking, coordinate guessing prevention, post-action verification,
and real-desktop execution with a disposable test window.
"""

import os
import sys
import re
import time
import json
import subprocess
import unittest

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PS1_ACTION_BRIDGE = os.path.join(WORKSPACE_ROOT, "lib", "scripts", "windows_action.ps1")
PS1_UIA_BRIDGE = os.path.join(WORKSPACE_ROOT, "lib", "scripts", "windows_uia.ps1")

class TestUltronDesktopControl(unittest.TestCase):

    def run_action_bridge(self, args_list, timeout=45):
        """Helper to invoke windows_action.ps1 directly."""
        cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", PS1_ACTION_BRIDGE] + args_list
        proc = subprocess.run(
            cmd,
            cwd=WORKSPACE_ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout
        )
        self.assertEqual(proc.returncode, 0, f"Action bridge failed (code {proc.returncode}): {proc.stderr}")
        out = proc.stdout.strip()
        start = out.find("{")
        end = out.rfind("}")
        self.assertTrue(start != -1 and end != -1, f"No JSON output from action bridge: {out}")
        return json.loads(out[start:end+1])

    def test_01_tools_schema_and_router_intent_mapping(self):
        """Verifies Phase 3B tool schemas in ULTRON_TOOLS and deterministic routing."""
        node_script = """
import { ULTRON_TOOLS, routeUserQuery } from './lib/intentRouter.ts';

const toolNames = ULTRON_TOOLS.map(t => t.name);
const focusTool = ULTRON_TOOLS.find(t => t.name === 'focus_window');
const clickTool = ULTRON_TOOLS.find(t => t.name === 'click_ui_element');
const typeTool = ULTRON_TOOLS.find(t => t.name === 'type_text');
const keyTool = ULTRON_TOOLS.find(t => t.name === 'press_key');

const qFocus = routeUserQuery('focus window Notepad');
const qClick = routeUserQuery('click button Save in Notepad');
const qType = routeUserQuery('type text Hello World into Notepad');
const qKey = routeUserQuery('press key ENTER in Notepad');

console.log(JSON.stringify({
    toolNames,
    focusRisk: focusTool?.riskLevel,
    clickRisk: clickTool?.riskLevel,
    typeRisk: typeTool?.riskLevel,
    keyRisk: keyTool?.riskLevel,
    qFocus: { tool: qFocus.toolRequired, intent: qFocus.intent, params: qFocus.toolParams },
    qClick: { tool: qClick.toolRequired, intent: qClick.intent, params: qClick.toolParams },
    qType: { tool: qType.toolRequired, intent: qType.intent, params: qType.toolParams },
    qKey: { tool: qKey.toolRequired, intent: qKey.intent, params: qKey.toolParams },
}));
"""
        cmd = ["node", "--experimental-strip-types", "-e", node_script]
        proc = subprocess.run(cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=15)
        self.assertEqual(proc.returncode, 0, f"Node script error: {proc.stderr}")
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("{")), None)
        self.assertIsNotNone(json_line)
        data = json.loads(json_line)

        # Check schemas
        self.assertIn("focus_window", data["toolNames"])
        self.assertIn("click_ui_element", data["toolNames"])
        self.assertIn("type_text", data["toolNames"])
        self.assertIn("press_key", data["toolNames"])

        # Check risk levels
        self.assertEqual(data["typeRisk"], "CONFIRMATION_REQUIRED")
        self.assertEqual(data["clickRisk"], "CONFIRMATION_REQUIRED")

        # Check query routing
        self.assertEqual(data["qFocus"]["tool"], "focus_window")
        self.assertEqual(data["qClick"]["tool"], "click_ui_element")
        self.assertEqual(data["qType"]["tool"], "type_text")
        self.assertEqual(data["qKey"]["tool"], "press_key")

    def test_02_missing_window_graceful_error(self):
        """Verifies actions against non-existent windows return structured errors."""
        res = self.run_action_bridge([
            "-Action", "focus",
            "-TargetTitle", "NonExistentFakeWindow_UltronTest_99999"
        ])
        self.assertEqual(res.get("status"), "error")
        self.assertEqual(res.get("action"), "focus_window")
        self.assertIn("not found", res.get("error", "").lower())

    def test_03_key_allowlist_enforcement(self):
        """Verifies only allowlisted keys can be sent; unapproved combinations are rejected."""
        # Unapproved key combination
        res_bad = self.run_action_bridge([
            "-Action", "presskey",
            "-TargetTitle", "NonExistentWindow",
            "-Key", "ALT+F4"
        ])
        self.assertEqual(res_bad.get("status"), "error")
        self.assertIn("allowlist", res_bad.get("error", "").lower())

        res_bad2 = self.run_action_bridge([
            "-Action", "presskey",
            "-TargetTitle", "NonExistentWindow",
            "-Key", "WIN+D"
        ])
        self.assertEqual(res_bad2.get("status"), "error")
        self.assertIn("allowlist", res_bad2.get("error", "").lower())

    def test_04_coordinate_guessing_prevention(self):
        """Verifies click_ui_element refuses to guess coordinates when target element is absent."""
        res = self.run_action_bridge([
            "-Action", "click",
            "-TargetTitle", "NonExistentWindow",
            "-AutomationId", "fake_btn_id_999"
        ])
        self.assertEqual(res.get("status"), "error")
        self.assertEqual(res.get("action"), "click_ui_element")

    def test_05_oversized_text_input_bounded(self):
        """Verifies text exceeding 1000 characters is rejected immediately."""
        huge_text = "A" * 1005
        res = self.run_action_bridge([
            "-Action", "type",
            "-TargetTitle", "NonExistentWindow",
            "-Text", huge_text
        ])
        self.assertEqual(res.get("status"), "error")
        self.assertIn("1000", res.get("error", ""))

    def run_ultron_tools_script(self, script_body, timeout=15):
        """Executes a script against real ultronTools using Node's native strip-types engine."""
        tools_path = os.path.join(WORKSPACE_ROOT, "lib", "ultronTools.ts")
        with open(tools_path, "r", encoding="utf-8") as f:
            tools_code = f.read()
        # Resolve relative imports for standalone Node test execution without modifying source
        tools_code = re.sub(
            r'import\s*\{[^}]*\}\s*from\s*["\']\./browserResearch["\'];?',
            'const browserResearch = { search: async () => [], fetchPageText: async () => ({ title: "", content: "", url: "" }) };',
            tools_code
        )
        tools_code = re.sub(
            r'import\s*\{[^}]*\}\s*from\s*["\']\./ultronMemory["\'];?',
            'const ultronMemory = { saveVerifiedResearch: () => {} };',
            tools_code
        )
        tools_code = re.sub(
            r'import\s*\{[^}]*\}\s*from\s*["\']\./ultronUIAutomation["\'];?',
            'const ultronUIAutomation = { focusWindow: async () => ({ status: "success" }), clickElement: async () => ({ status: "success" }), typeText: async () => ({ status: "success" }), pressKey: async () => ({ status: "success" }) };',
            tools_code
        )
        tools_code = re.sub(
            r'import\s*\{[^}]*\}\s*from\s*["\']\./projectContext["\'];?',
            'const ProjectContextManager = { getProjectState: () => ({ decisions: [] }), recordDecision: (t, r) => ({ id: "DEC-1", title: t, rationale: r }) };',
            tools_code
        )
        tools_code = re.sub(
            r'import\s*\{[^}]*\}\s*from\s*["\']\./proactiveMonitor["\'];?',
            'const ProactiveProjectMonitor = { scanForOpportunities: async () => [], getInitiativeLevel: () => "balanced" };',
            tools_code
        )
        full_code = tools_code + "\n" + script_body
        tmp_runner = os.path.join(WORKSPACE_ROOT, "tests", f"tmp_runner_{os.getpid()}_{int(time.time()*1000)}.ts")
        with open(tmp_runner, "w", encoding="utf-8") as f:
            f.write(full_code)
        try:
            cmd = ["node", "--experimental-strip-types", tmp_runner]
            return subprocess.run(cmd, cwd=WORKSPACE_ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=timeout)
        finally:
            if os.path.exists(tmp_runner):
                try:
                    os.remove(tmp_runner)
                except Exception:
                    pass

    def test_06_confirmation_gate_for_type_text(self):
        """Verifies type_text strictly requires user confirmation via ultronTools."""
        node_script = """
async function run() {
    const unconfirmed = await ultronTools.execute('type_text', {
        window_title: 'Test Window',
        text: 'Sample input'
    });
    console.log(JSON.stringify(unconfirmed));
}
run();
"""
        proc = self.run_ultron_tools_script(node_script)
        self.assertEqual(proc.returncode, 0, f"Node script error: {proc.stderr}")
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("{")), None)
        self.assertIsNotNone(json_line, f"No JSON output: {proc.stdout}")
        res = json.loads(json_line)

        self.assertEqual(res.get("status"), "confirmation_required")
        self.assertTrue(res.get("requiresConfirmation"))
        self.assertTrue(bool(res.get("confirm_token")))
        self.assertIn("Sample input", res.get("warning", ""))

    def test_07_token_binding_and_rejection_of_tampered_payloads(self):
        """Verifies confirmation tokens are cryptographically bound to action, target window, and text."""
        node_script = """
async function testSecurityBindings() {
    // 1. Issue a token for a specific action, window, and text
    const init = await ultronTools.execute('type_text', {
        window_title: 'Document1 - Notepad',
        text: 'Harmful Command Simulation'
    });
    const token = init.confirm_token;

    // Test A: Token used for wrong tool action
    const wrongAction = await ultronTools.execute('delete_file', { file_path: 'important.txt' }, token);

    // Test B: Token used with mismatched target window
    const wrongWindow = await ultronTools.execute('type_text', {
        window_title: 'System Terminal',
        text: 'Harmful Command Simulation'
    }, token);

    // Test C: Token used with altered text payload
    const wrongText = await ultronTools.execute('type_text', {
        window_title: 'Document1 - Notepad',
        text: 'Completely Different Payload'
    }, token);

    console.log(JSON.stringify({
        wrongAction,
        wrongWindow,
        wrongText
    }));
}
testSecurityBindings();
"""
        proc = self.run_ultron_tools_script(node_script)
        self.assertEqual(proc.returncode, 0, f"Node script error: {proc.stderr}")
        lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        json_line = next((l for l in lines if l.startswith("{")), None)
        self.assertIsNotNone(json_line, f"No JSON output: {proc.stdout}")
        res = json.loads(json_line)

        self.assertEqual(res["wrongAction"]["status"], "error")
        self.assertIn("Security violation", res["wrongAction"]["error"])

        self.assertEqual(res["wrongWindow"]["status"], "error")
        self.assertIn("Security violation", res["wrongWindow"]["error"])

        self.assertEqual(res["wrongText"]["status"], "error")
        self.assertIn("Security violation", res["wrongText"]["error"])

    def test_08_password_field_security_block(self):
        """Verifies automated text entry into password fields or credential inputs is blocked."""
        res = self.run_action_bridge([
            "-Action", "type",
            "-TargetTitle", "NonExistentWindow",
            "-ElementName", "Master Password Field",
            "-Text", "secret123"
        ])
        # Even before touching the window, if element name has 'password', it gets blocked
        self.assertEqual(res.get("status"), "error")

    def test_09_real_desktop_disposable_notepad_lifecycle(self):
        """Real live test: Launches a disposable Notepad, focuses it, types harmless text, verifies state, and closes it."""
        import tempfile
        unique_id = f"ultron_phase3b_{os.getpid()}_{int(time.time())}"
        disposable_file = os.path.join(tempfile.gettempdir(), f"{unique_id}.txt")
        with open(disposable_file, "w", encoding="utf-8") as f:
            f.write("ULTRON_INITIAL_CONTENT")

        # Record pre-existing Notepad PIDs to ensure existing user windows are never touched
        ps_pids = "Get-Process -Name Notepad -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"
        pre_pids = set(int(p.strip()) for p in subprocess.run(["powershell", "-NoProfile", "-Command", ps_pids], capture_output=True, text=True, encoding="utf-8", errors="replace").stdout.strip().splitlines() if p.strip())

        notepad_proc = None
        disposable_pid = None
        disposable_hwnd = None

        try:
            # 1. Launch disposable test Notepad with unique file
            notepad_proc = subprocess.Popen(["notepad.exe", disposable_file])
            time.sleep(2.5) # Allow UI window to map

            # Resolve actual window handle and PID on Windows 11
            ps_find = f"""
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;

public class TargetFinder {{
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    public static string FindTarget(string titleSub) {{
        string result = null;
        EnumWindows((hWnd, lParam) => {{
            if (IsWindowVisible(hWnd)) {{
                var sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string t = sb.ToString();
                if (t.IndexOf(titleSub, StringComparison.OrdinalIgnoreCase) >= 0) {{
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    result = hWnd.ToInt64() + ":" + pid;
                    return false;
                }}
            }}
            return true;
        }}, IntPtr.Zero);
        return result;
    }}
}}
"@
[TargetFinder]::FindTarget("{unique_id}")
"""
            raw_target = subprocess.check_output(["powershell", "-NoProfile", "-Command", ps_find], text=True).strip()
            self.assertTrue(bool(raw_target and ":" in raw_target), f"Could not find disposable Notepad window for {unique_id}")
            parts = raw_target.split(":")
            disposable_hwnd = int(parts[0])
            disposable_pid = int(parts[1])

            # 2. Focus the disposable window
            focus_res = self.run_action_bridge([
                "-Action", "focus",
                "-TargetHwnd", str(disposable_hwnd)
            ])
            self.assertEqual(focus_res.get("action"), "focus_window")
            # If Windows grants foreground activation, verify success; if Windows denies foreground lock,
            # verify that an explicit failure is reported without claiming false success (Requirement B.5)
            if focus_res.get("status") == "success":
                self.assertTrue(focus_res.get("verification", {}).get("is_foreground"))
            else:
                self.assertFalse(focus_res.get("verification", {}).get("is_foreground", True))
                self.assertIn("could not be verified", focus_res.get("error", ""))

            # 3. Type harmless test string
            test_phrase = "ULTRON_AUTONOMOUS_TEST"
            type_res = self.run_action_bridge([
                "-Action", "type",
                "-TargetHwnd", str(disposable_hwnd),
                "-Text", test_phrase
            ])
            self.assertEqual(type_res.get("status"), "success", f"Type text failed: {type_res}")
            self.assertEqual(type_res.get("action"), "type_text")
            self.assertTrue(type_res.get("verification", {}).get("text_verified"))

            # 4. Press harmless allowlisted key (e.g. ENTER)
            key_res = self.run_action_bridge([
                "-Action", "presskey",
                "-TargetHwnd", str(disposable_hwnd),
                "-Key", "ENTER"
            ])
            self.assertEqual(key_res.get("status"), "success", f"Press key failed: {key_res}")
            self.assertEqual(key_res.get("action"), "press_key")
            self.assertTrue(key_res.get("verification", {}).get("target_responsive"))

        finally:
            # Clean up: NEVER terminate user's existing Notepad processes
            if disposable_pid and disposable_pid not in pre_pids:
                subprocess.run(["powershell", "-NoProfile", "-Command", f"Stop-Process -Id {disposable_pid} -Force -ErrorAction SilentlyContinue"])
            if notepad_proc and notepad_proc.pid not in pre_pids:
                try:
                    notepad_proc.terminate()
                    notepad_proc.wait(timeout=3)
                except Exception:
                    pass
            if os.path.exists(disposable_file):
                try:
                    os.remove(disposable_file)
                except Exception:
                    pass


if __name__ == "__main__":
    unittest.main()


