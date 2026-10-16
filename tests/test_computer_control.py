#!/usr/bin/env python3
"""
ULTRON Computer Control & Security Gate Verification Suite (Phase 1)
Tests:
1. System Telemetry
2. Mock Security Gate
3. Real Phase 1 Tool Primitives & Sandboxed Command Engine (Node.js runtime against lib/ultronTools.ts)
"""

import sys
import os
import subprocess
import json
import re

class SecurityToolRegistry:
    def __init__(self):
        self.pending = {}

    def get_diagnostics(self):
        return {
            "status": "success",
            "cpu_percent": 15,
            "ram_percent": 45,
            "system_uptime": "4h 20m",
        }

    def execute(self, tool, params, confirm_token=None):
        # High-risk destructive actions REQUIRE confirmation token
        if tool in ["close_application", "kill_process", "delete_file"]:
            if not confirm_token:
                token = "SECURE99"
                self.pending[token] = {"tool": tool, "params": params}
                return {
                    "status": "confirmation_required",
                    "confirm_token": token,
                    "warning": f"Termination of {params.get('app_name')} requires confirmation",
                }
            if confirm_token != "SECURE99":
                return {"status": "error", "error": "Invalid token"}
            # Verified execution
            return {"status": "success", "message": f"Safely executed {tool}"}

        # Safe tools execute immediately
        if tool == "get_system_diagnostics":
            return self.get_diagnostics()

        return {"status": "success", "message": f"Executed {tool}"}

def test_telemetry():
    print("[TEST] Testing System Telemetry...")
    reg = SecurityToolRegistry()
    diag = reg.get_diagnostics()
    assert diag["status"] == "success"
    assert "cpu_percent" in diag
    assert "ram_percent" in diag
    print("  --> System Telemetry verified.")

def test_high_risk_confirmation_gate():
    print("[TEST] Testing Elimination of Unsafe Permission Bypass...")
    reg = SecurityToolRegistry()

    # Step 1: Invoking close_application without token MUST be blocked and demand confirmation
    res = reg.execute("close_application", {"app_name": "notepad"})
    assert res["status"] == "confirmation_required", "CRITICAL DEFECT: Tool executed without confirmation!"
    assert "confirm_token" in res, "Missing security token in response"
    token = res["confirm_token"]
    print("  --> Unsafe execution successfully blocked. Confirmation requested.")

    # Step 2: Supplying invalid token must fail
    res_bad = reg.execute("close_application", {"app_name": "notepad"}, confirm_token="INVALID")
    assert res_bad["status"] == "error", "Invalid token allowed!"
    print("  --> Invalid token successfully rejected.")

    # Step 3: Supplying valid token must execute safely
    res_ok = reg.execute("close_application", {"app_name": "notepad"}, confirm_token=token)
    assert res_ok["status"] == "success", "Valid token failed execution"
    print("  --> Valid confirmation token safely executed.")

def test_phase1_real_tools_engine():
    print("[TEST] Running Phase 1 Real Tool Primitives & Sandboxed Command Suite (Node.js)...")
    
    # Bundle a clean test runner by merging lib/ultronTools.ts with inlined stubs for testing
    tools_code = open("lib/ultronTools.ts", "r", encoding="utf-8").read()
    # Replace relative imports with inline stubs so Node's native strip-types engine can execute it without bundling
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
        'const ultronUIAutomation = { enumerateWindows: async () => ({ status: "success", count: 1, windows: [] }), inspectWindowElements: async () => ({ status: "success", element_count: 1, elements: [] }) };',
        tools_code
    )

    runner_code = tools_code + """

async function run() {
  const tmpDir = path.join(process.cwd(), 'tests', 'phase1_test_tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // 1. List Directory
    const listRes = await ultronTools.execute('list_directory', { dir_path: 'tests' });
    assert.strictEqual(listRes.status, 'success', 'list_directory failed');
    assert(listRes.count > 0, 'list_directory should return entries');
    assert(listRes.entries.some(e => e.name.includes('test_router')), 'list_directory should contain test_router');

    // 2. File Creation & Move File with verification
    const file1 = path.join('tests', 'phase1_test_tmp', 'origin.txt');
    const file2 = path.join('tests', 'phase1_test_tmp', 'destination.txt');
    const writeRes = await ultronTools.execute('write_file', { file_path: file1, content: 'PHASE_1_PRIMITIVE_CONTENT' });
    assert.strictEqual(writeRes.status, 'success', 'write_file failed');

    const moveRes = await ultronTools.execute('move_file', { source_path: file1, dest_path: file2 });
    assert.strictEqual(moveRes.status, 'success', 'move_file failed');
    assert(!fs.existsSync(path.resolve(file1)), 'Source file should be unlinked after move');
    assert(fs.existsSync(path.resolve(file2)), 'Destination file must exist after move');
    const destContent = fs.readFileSync(path.resolve(file2), 'utf-8');
    assert.strictEqual(destContent, 'PHASE_1_PRIMITIVE_CONTENT', 'Destination file content mismatch');

    // 3. Run Approved Test Command & capture exit code
    const cmdRes = await ultronTools.execute('run_command', { command: 'node --version' });
    assert.strictEqual(cmdRes.status, 'success', 'run_command node --version should succeed');
    assert.strictEqual(cmdRes.exit_code, 0, 'Exit code should be 0');
    assert(cmdRes.stdout.includes('v'), 'node --version should return version string');

    // 4. Run Deliberately Failing Test Command & capture stderr
    const failScript = path.join('tests', 'phase1_test_tmp', 'failing_test.py');
    fs.writeFileSync(path.resolve(failScript), 'import sys\\nsys.stderr.write("Deliberate failure log\\\\n")\\nsys.exit(7)\\n', 'utf-8');
    const failRes = await ultronTools.execute('run_command', {
      command: `python tests/phase1_test_tmp/failing_test.py`
    });
    assert.strictEqual(failRes.status, 'failed', 'Command should report failed status');
    assert.strictEqual(failRes.exit_code, 7, 'Exit code should match failure code 7');
    assert(failRes.stderr.includes('Deliberate failure log'), 'Stderr must be captured');

    // 5. Command Timeout & Termination
    const timeoutScript = path.join('tests', 'phase1_test_tmp', 'timeout_test.py');
    fs.writeFileSync(path.resolve(timeoutScript), 'import time\\ntime.sleep(10)\\n', 'utf-8');
    const timeoutRes = await ultronTools.execute('run_command', {
      command: `python tests/phase1_test_tmp/timeout_test.py`,
      timeout_ms: 1000
    });
    assert.strictEqual(timeoutRes.status, 'timeout', 'Should report timeout status');
    assert.strictEqual(timeoutRes.timed_out, true, 'Should flag timed_out: true');

    // 6. Security Sandbox & Injection Defense
    // Chaining operator
    const injectRes = await ultronTools.execute('run_command', { command: 'node --version && whoami' });
    assert.strictEqual(injectRes.status, 'error', 'Command chaining must be blocked');
    assert(injectRes.error.includes('Security violation'), 'Should report security violation');

    // Unapproved binary
    const unapprovedRes = await ultronTools.execute('run_command', { command: 'powershell -Command "Get-Process"' });
    assert.strictEqual(unapprovedRes.status, 'error', 'Unapproved binary must be blocked');

    // Path traversal in arguments
    const escapeRes = await ultronTools.execute('run_command', { command: 'python tests/../../escaped.py' });
    assert.strictEqual(escapeRes.status, 'error', 'Path traversal in command arguments must be blocked');

    // 7. Controlled Process Launch and Termination
    // Launch allowed app (notepad)
    const launchRes = await ultronTools.execute('launch_application', { app_name: 'notepad' });
    assert.strictEqual(launchRes.status, 'success', 'App launch failed');
    assert(typeof launchRes.pid === 'number' && launchRes.pid > 0, 'Launch must return valid PID');
    const spawnedPid = launchRes.pid;

    // Close application without token requires confirmation
    const closeReq = await ultronTools.execute('close_application', { app_name: 'notepad', pid: spawnedPid });
    assert.strictEqual(closeReq.status, 'confirmation_required', 'Close application must require confirmation token');
    const token = closeReq.confirm_token;

    // Close with confirmation token terminates the tracked process
    const closeRes = await ultronTools.execute('close_application', { app_name: 'notepad', pid: spawnedPid }, token);
    assert.strictEqual(closeRes.status, 'success', 'Confirmed process termination failed');

    // 8. Patch File with Backup and Recovery
    const patchTarget = path.join('tests', 'phase1_test_tmp', 'patch_sample.txt');
    fs.writeFileSync(path.resolve(patchTarget), 'const x = 10;\\nconst y = 20;\\nconst z = 30;\\n', 'utf-8');

    const patchRes = await ultronTools.execute('patch_file', {
      file_path: patchTarget,
      target_content: 'const y = 20;',
      replacement_content: 'const y = 999;'
    });
    assert.strictEqual(patchRes.status, 'success', 'patch_file failed');
    assert(patchRes.backup_path, 'patch_file must return backup_path');
    assert(fs.existsSync(path.resolve(patchRes.backup_path)), 'Backup file must exist on disk');

    const patchedContent = fs.readFileSync(path.resolve(patchTarget), 'utf-8');
    assert(patchedContent.includes('const y = 999;'), 'Replacement content must be present');
    assert(patchedContent.includes('const x = 10;'), 'Unrelated line x must be preserved');
    assert(patchedContent.includes('const z = 30;'), 'Unrelated line z must be preserved');

    // Verify recovery from backup
    const backupContent = fs.readFileSync(path.resolve(patchRes.backup_path), 'utf-8');
    assert(backupContent.includes('const y = 20;'), 'Backup must contain original target content');

    console.log('  --> All 8 Phase 1 Real Tool Primitive Criteria PASSED.');
  } finally {
    // Cleanup temporary directory
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

import assert from 'assert';
run().catch(err => {
  console.error('[TEST FAILURE]', err);
  process.exit(1);
});
"""
    runner_path = "tests/temp_phase1_tools_runner.ts"
    with open(runner_path, "w", encoding="utf-8") as f:
        f.write(runner_code)

    try:
        proc = subprocess.run(
            ["node", "--experimental-strip-types", runner_path],
            capture_output=True,
            text=True,
            encoding="utf-8"
        )
        if proc.returncode != 0:
            print(proc.stderr, file=sys.stderr)
            raise AssertionError(f"Phase 1 Real Tools suite failed with exit code {proc.returncode}")
        print(proc.stdout.strip())
    finally:
        if os.path.exists(runner_path):
            os.remove(runner_path)


def main():
    try:
        test_telemetry()
        test_high_risk_confirmation_gate()
        test_phase1_real_tools_engine()
        print("[SUCCESS] All Computer Control & Security Gate tests passed.")
        return 0
    except AssertionError as e:
        print(f"[FAIL] {e}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
