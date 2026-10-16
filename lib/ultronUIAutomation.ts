/**
 * ULTRON Native Windows UI Automation Bridge (Phase 3A)
 * 
 * Inspects real Windows desktop windows and their accessible UI elements
 * using lightweight, local Windows UI Automation interfaces via PowerShell/.NET.
 * 
 * STRICTLY READ-ONLY: No mouse clicks, typing, keystrokes, process killing, or state mutations.
 */

import path from "path";
import { spawn } from "child_process";

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowSummary {
  hwnd: number;
  pid: number;
  process_name: string;
  title: string;
  class_name: string;
  is_visible: boolean;
  is_minimized: boolean;
  bounds: WindowBounds;
}

export interface ElementInfo {
  depth: number;
  name: string;
  automation_id: string;
  control_type: string;
  class_name: string;
  is_enabled: boolean;
  has_keyboard_focus: boolean;
  is_offscreen: boolean;
  bounds: WindowBounds;
}

export interface EnumerateWindowsResult {
  status: "success" | "error";
  count?: number;
  windows?: WindowSummary[];
  error?: string;
}

export interface InspectWindowResult {
  status: "success" | "error";
  window_root?: ElementInfo;
  element_count?: number;
  elements?: ElementInfo[];
  error?: string;
  target?: {
    hwnd?: number;
    pid?: number;
    title?: string;
    process?: string;
  };
}

const BRIDGE_SCRIPT_PATH = path.resolve(process.cwd(), "lib/scripts/windows_uia.ps1");
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB max stdout buffer

/**
 * Executes the native PowerShell UIA bridge script safely with bounded timeout and process tree cleanup.
 */
async function runUiaBridge(args: string[], timeoutMs = 12000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", BRIDGE_SCRIPT_PATH, ...args],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: {
          ...process.env,
          SYSTEMROOT: process.env.SYSTEMROOT || "C:\\Windows",
          WINDIR: process.env.WINDIR || "C:\\Windows",
          PATH: process.env.PATH || "",
        },
      }
    );

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          child.kill("SIGKILL");
        } catch {}
        resolve({
          stdout,
          stderr: `UI Automation bridge operation timed out after ${timeoutMs}ms.`,
          exitCode: -1,
        });
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdout.length < MAX_OUTPUT_BYTES) {
        stdout += chunk.toString("utf-8");
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < MAX_OUTPUT_BYTES) {
        stderr += chunk.toString("utf-8");
      }
    });

    child.on("error", (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: `UI Automation bridge spawn error: ${err.message}`,
          exitCode: 1,
        });
      }
    });

    child.on("close", (code: number | null) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
        });
      }
    });
  });
}

export const ultronUIAutomation = {
  /**
   * Discovers top-level desktop windows and returns their titles, PIDs, HWNDs, and window bounds.
   * Read-only inspection.
   */
  async enumerateWindows(filter?: string, timeoutMs = 10000): Promise<EnumerateWindowsResult> {
    try {
      const args = ["-Action", "enumerate"];
      if (filter && typeof filter === "string") {
        const sanitizedFilter = filter.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (sanitizedFilter) {
          args.push("-Filter", sanitizedFilter);
        }
      }

      const res = await runUiaBridge(args, timeoutMs);

      if (res.exitCode !== 0 && !res.stdout) {
        return {
          status: "error",
          error: res.stderr || `PowerShell bridge exited with code ${res.exitCode}`,
        };
      }

      // Parse JSON from output
      const jsonStart = res.stdout.indexOf("{");
      const jsonEnd = res.stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          status: "error",
          error: `Invalid output from UI Automation bridge: ${res.stdout.slice(0, 200)}`,
        };
      }

      const parsed = JSON.parse(res.stdout.slice(jsonStart, jsonEnd + 1));
      return parsed as EnumerateWindowsResult;
    } catch (err: any) {
      return {
        status: "error",
        error: `UI Automation enumeration error: ${err.message}`,
      };
    }
  },

  /**
   * Inspects the accessibility tree of a requested desktop window.
   * Extracts control types, names, AutomationIds, focus/enabled state, and bounds.
   * Strictly read-only; no click or input actions exist.
   */
  async inspectWindowElements(
    params: {
      hwnd?: number;
      pid?: number;
      title?: string;
      process_name?: string;
      maxDepth?: number;
      maxElements?: number;
    },
    timeoutMs = 15000
  ): Promise<InspectWindowResult> {
    try {
      const args = ["-Action", "inspect"];

      if (params.hwnd && Number.isInteger(params.hwnd) && params.hwnd > 0) {
        args.push("-TargetHwnd", params.hwnd.toString());
      }
      if (params.pid && Number.isInteger(params.pid) && params.pid > 0) {
        args.push("-TargetPid", params.pid.toString());
      }
      if (params.title && typeof params.title === "string") {
        const cleanTitle = params.title.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanTitle) {
          args.push("-TargetTitle", cleanTitle);
        }
      }
      if (params.process_name && typeof params.process_name === "string") {
        const cleanProc = params.process_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanProc) {
          args.push("-TargetProcess", cleanProc);
        }
      }

      const depth = Math.min(6, Math.max(1, params.maxDepth || 3));
      args.push("-MaxDepth", depth.toString());

      const elements = Math.min(100, Math.max(1, params.maxElements || 50));
      args.push("-MaxElements", elements.toString());

      const res = await runUiaBridge(args, timeoutMs);

      if (res.exitCode !== 0 && !res.stdout) {
        return {
          status: "error",
          error: res.stderr || `PowerShell bridge exited with code ${res.exitCode}`,
        };
      }

      const jsonStart = res.stdout.indexOf("{");
      const jsonEnd = res.stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          status: "error",
          error: `Invalid output from UI Automation bridge: ${res.stdout.slice(0, 200)}`,
        };
      }

      const parsed = JSON.parse(res.stdout.slice(jsonStart, jsonEnd + 1));
      return parsed as InspectWindowResult;
    } catch (err: any) {
      return {
        status: "error",
        error: `UI Automation inspection error: ${err.message}`,
      };
    }
  },
};
