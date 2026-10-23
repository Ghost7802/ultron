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

export interface DesktopActionResult {
  status: "success" | "error";
  action: string;
  error?: string;
  message?: string;
  target?: Record<string, any>;
  verification?: Record<string, any>;
}

const BRIDGE_SCRIPT_PATH = path.resolve(process.cwd(), "lib/scripts/windows_uia.ps1");
const ACTION_SCRIPT_PATH = path.resolve(process.cwd(), "lib/scripts/windows_action.ps1");
const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB max stdout buffer

async function runActionBridge(args: string[], timeoutMs = 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ACTION_SCRIPT_PATH, ...args],
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
          stderr: `Action bridge operation timed out after ${timeoutMs}ms.`,
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
          stderr: `Action bridge spawn error: ${err.message}`,
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

  /**
   * Brings an explicitly identified target window to foreground and verifies state.
   */
  async focusWindow(
    params: {
      hwnd?: number;
      pid?: number;
      title?: string;
      process_name?: string;
    },
    timeoutMs = 12000
  ): Promise<DesktopActionResult> {
    try {
      const args = ["-Action", "focus"];
      if (params.hwnd && Number.isInteger(params.hwnd) && params.hwnd > 0) {
        args.push("-TargetHwnd", params.hwnd.toString());
      }
      if (params.pid && Number.isInteger(params.pid) && params.pid > 0) {
        args.push("-TargetPid", params.pid.toString());
      }
      if (params.title && typeof params.title === "string") {
        const cleanTitle = params.title.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanTitle) args.push("-TargetTitle", cleanTitle);
      }
      if (params.process_name && typeof params.process_name === "string") {
        const cleanProc = params.process_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanProc) args.push("-TargetProcess", cleanProc);
      }

      const res = await runActionBridge(args, timeoutMs);
      const jsonStart = res.stdout.indexOf("{");
      const jsonEnd = res.stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          status: "error",
          action: "focus_window",
          error: res.stderr || `Invalid output from desktop bridge: ${res.stdout.slice(0, 200)}`,
        };
      }
      return JSON.parse(res.stdout.slice(jsonStart, jsonEnd + 1)) as DesktopActionResult;
    } catch (err: any) {
      return {
        status: "error",
        action: "focus_window",
        error: `Desktop focus execution error: ${err.message}`,
      };
    }
  },

  /**
   * Clicks an element identified through the UIA tree and its stable properties.
   * Never uses guessed coordinates.
   */
  async clickElement(
    params: {
      hwnd?: number;
      pid?: number;
      title?: string;
      process_name?: string;
      automation_id?: string;
      element_name?: string;
      control_type?: string;
    },
    timeoutMs = 15000
  ): Promise<DesktopActionResult> {
    try {
      const args = ["-Action", "click"];
      if (params.hwnd && Number.isInteger(params.hwnd) && params.hwnd > 0) {
        args.push("-TargetHwnd", params.hwnd.toString());
      }
      if (params.pid && Number.isInteger(params.pid) && params.pid > 0) {
        args.push("-TargetPid", params.pid.toString());
      }
      if (params.title && typeof params.title === "string") {
        const cleanTitle = params.title.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanTitle) args.push("-TargetTitle", cleanTitle);
      }
      if (params.process_name && typeof params.process_name === "string") {
        const cleanProc = params.process_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanProc) args.push("-TargetProcess", cleanProc);
      }
      if (params.automation_id && typeof params.automation_id === "string") {
        const cleanId = params.automation_id.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanId) args.push("-AutomationId", cleanId);
      }
      if (params.element_name && typeof params.element_name === "string") {
        const cleanName = params.element_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanName) args.push("-ElementName", cleanName);
      }
      if (params.control_type && typeof params.control_type === "string") {
        const cleanType = params.control_type.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanType) args.push("-ControlType", cleanType);
      }

      const res = await runActionBridge(args, timeoutMs);
      const jsonStart = res.stdout.indexOf("{");
      const jsonEnd = res.stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          status: "error",
          action: "click_ui_element",
          error: res.stderr || `Invalid output from desktop bridge: ${res.stdout.slice(0, 200)}`,
        };
      }
      return JSON.parse(res.stdout.slice(jsonStart, jsonEnd + 1)) as DesktopActionResult;
    } catch (err: any) {
      return {
        status: "error",
        action: "click_ui_element",
        error: `Desktop click execution error: ${err.message}`,
      };
    }
  },

  /**
   * Types text into a verified, focused input control.
   */
  async typeText(
    params: {
      hwnd?: number;
      pid?: number;
      title?: string;
      process_name?: string;
      automation_id?: string;
      element_name?: string;
      control_type?: string;
      text: string;
    },
    timeoutMs = 15000
  ): Promise<DesktopActionResult> {
    try {
      if (!params.text || typeof params.text !== "string") {
        return {
          status: "error",
          action: "type_text",
          error: "Text parameter is required and cannot be empty.",
        };
      }
      if (params.text.length > 1000) {
        return {
          status: "error",
          action: "type_text",
          error: "Text exceeds maximum safety bound of 1000 characters.",
        };
      }

      const args = ["-Action", "type"];
      if (params.hwnd && Number.isInteger(params.hwnd) && params.hwnd > 0) {
        args.push("-TargetHwnd", params.hwnd.toString());
      }
      if (params.pid && Number.isInteger(params.pid) && params.pid > 0) {
        args.push("-TargetPid", params.pid.toString());
      }
      if (params.title && typeof params.title === "string") {
        const cleanTitle = params.title.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanTitle) args.push("-TargetTitle", cleanTitle);
      }
      if (params.process_name && typeof params.process_name === "string") {
        const cleanProc = params.process_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanProc) args.push("-TargetProcess", cleanProc);
      }
      if (params.automation_id && typeof params.automation_id === "string") {
        const cleanId = params.automation_id.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanId) args.push("-AutomationId", cleanId);
      }
      if (params.element_name && typeof params.element_name === "string") {
        const cleanName = params.element_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanName) args.push("-ElementName", cleanName);
      }
      if (params.control_type && typeof params.control_type === "string") {
        const cleanType = params.control_type.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanType) args.push("-ControlType", cleanType);
      }

      args.push("-Text", params.text);

      const res = await runActionBridge(args, timeoutMs);
      const jsonStart = res.stdout.indexOf("{");
      const jsonEnd = res.stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          status: "error",
          action: "type_text",
          error: res.stderr || `Invalid output from desktop bridge: ${res.stdout.slice(0, 200)}`,
        };
      }
      return JSON.parse(res.stdout.slice(jsonStart, jsonEnd + 1)) as DesktopActionResult;
    } catch (err: any) {
      return {
        status: "error",
        action: "type_text",
        error: `Desktop typing execution error: ${err.message}`,
      };
    }
  },

  /**
   * Sends an allowlisted keyboard key to the target window.
   */
  async pressKey(
    params: {
      hwnd?: number;
      pid?: number;
      title?: string;
      process_name?: string;
      key: string;
    },
    timeoutMs = 12000
  ): Promise<DesktopActionResult> {
    try {
      if (!params.key || typeof params.key !== "string") {
        return {
          status: "error",
          action: "press_key",
          error: "Key parameter is required.",
        };
      }

      const args = ["-Action", "presskey", "-Key", params.key.trim()];
      if (params.hwnd && Number.isInteger(params.hwnd) && params.hwnd > 0) {
        args.push("-TargetHwnd", params.hwnd.toString());
      }
      if (params.pid && Number.isInteger(params.pid) && params.pid > 0) {
        args.push("-TargetPid", params.pid.toString());
      }
      if (params.title && typeof params.title === "string") {
        const cleanTitle = params.title.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 100);
        if (cleanTitle) args.push("-TargetTitle", cleanTitle);
      }
      if (params.process_name && typeof params.process_name === "string") {
        const cleanProc = params.process_name.replace(/[;&|`$<>^!\n\r"]/g, "").trim().slice(0, 50);
        if (cleanProc) args.push("-TargetProcess", cleanProc);
      }

      const res = await runActionBridge(args, timeoutMs);
      const jsonStart = res.stdout.indexOf("{");
      const jsonEnd = res.stdout.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return {
          status: "error",
          action: "press_key",
          error: res.stderr || `Invalid output from desktop bridge: ${res.stdout.slice(0, 200)}`,
        };
      }
      return JSON.parse(res.stdout.slice(jsonStart, jsonEnd + 1)) as DesktopActionResult;
    } catch (err: any) {
      return {
        status: "error",
        action: "press_key",
        error: `Desktop key execution error: ${err.message}`,
      };
    }
  },
};
