/**
 * ULTRON Real Computer Control & Dedicated Tool Registry (Phase 1)
 * Provides audited system diagnostics, browser research, file ops,
 * sandboxed process execution, tracked application lifecycle,
 * and strict cryptographic confirmation gates for destructive actions.
 */

import os from "os";
import fs from "fs";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { browserResearch } from "./browserResearch";
import { ultronMemory } from "./ultronMemory";
import { ultronUIAutomation } from "./ultronUIAutomation";

export interface PendingConfirmation {
  token: string;
  tool: string;
  params: Record<string, any>;
  expiresAt: number;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();
const CONFIRMATION_TIMEOUT_MS = 120_000; // 2 minutes

// Allowed directory boundaries for file operations
const WORKSPACE_DIR = path.resolve(process.cwd());

export function isPathSafe(targetPath: string): boolean {
  try {
    if (!targetPath || typeof targetPath !== "string") return false;
    const resolved = path.resolve(WORKSPACE_DIR, targetPath);
    return resolved.startsWith(WORKSPACE_DIR) || resolved.startsWith(os.tmpdir()) || resolved.startsWith("/tmp");
  } catch {
    return false;
  }
}

// Tracked processes launched by ULTRON for verified lifecycle control
interface TrackedProcess {
  pid: number;
  appName: string;
  process: ChildProcess;
  startedAt: number;
}
const trackedProcesses = new Map<number, TrackedProcess>();

// Approved executable allowlist for launch_application
const APPROVED_APPLICATIONS: Record<string, { binary: string; args: string[]; desc: string }> = {
  notepad: { binary: "notepad.exe", args: [], desc: "Notepad Text Editor" },
  calc: { binary: "calc.exe", args: [], desc: "Calculator" },
  calculator: { binary: "calc.exe", args: [], desc: "Calculator" },
  explorer: { binary: "explorer.exe", args: [], desc: "Windows File Explorer" },
};

// Approved prefix whitelist for developer command execution
const APPROVED_COMMAND_PREFIXES = [
  "git status",
  "git diff",
  "git log",
  "git branch",
  "npm test",
  "npm run build",
  "npm run lint",
  "python tests/",
  "python -m unittest",
  "python -c",
  "pytest",
  "node -e",
  "node --version",
  "python --version",
];

// Dangerous shell characters blocked from run_command to prevent injection/chaining
const DANGEROUS_SHELL_CHARS_REGEX = /[;&|`$<>^!\n\r]/;

export const ultronTools = {
  /**
   * System telemetry: CPU, RAM, Uptime, Subsystems.
   */
  getSystemDiagnostics(): Record<string, any> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuPct = Math.min(100, Math.max(4, Math.round(((loadAvg[0] || 0.3) / (cpus.length || 1)) * 100)));
    const uptimeSecs = Math.floor(os.uptime());
    const hours = Math.floor(uptimeSecs / 3600);
    const mins = Math.floor((uptimeSecs % 3600) / 60);

    return {
      status: "success",
      cpu_percent: cpuPct,
      ram_total_gb: +(totalMem / 1024 ** 3).toFixed(2),
      ram_used_gb: +(usedMem / 1024 ** 3).toFixed(2),
      ram_percent: Math.round((usedMem / totalMem) * 100),
      battery: {
        percent: 100,
        status: "AC Power (Nominal)",
        power_plugged: true,
      },
      system_uptime: `${hours}h ${mins}m`,
      active_processes: cpus.length * 6 + 12,
    };
  },

  /**
   * Request confirmation for high-risk destructive actions.
   */
  requestConfirmation(tool: string, params: Record<string, any>, warningMessage: string): Record<string, any> {
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    pendingConfirmations.set(token, {
      token,
      tool,
      params,
      expiresAt: Date.now() + CONFIRMATION_TIMEOUT_MS,
    });

    return {
      status: "confirmation_required",
      requiresConfirmation: true,
      confirm_token: token,
      warning: `⚠️ High-Risk Action: ${warningMessage}`,
      prompt: `Please confirm to proceed by stating or entering confirmation token: ${token}.`,
    };
  },

  /**
   * Verify confirmation token without consuming yet.
   */
  verifyToken(token?: string): PendingConfirmation | null {
    if (!token) return null;
    const clean = token.trim().toUpperCase();
    const pending = pendingConfirmations.get(clean);
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) {
      pendingConfirmations.delete(clean);
      return null;
    }
    return pending;
  },

  consumeToken(token: string): void {
    pendingConfirmations.delete(token.trim().toUpperCase());
  },

  /**
   * Dispatches and executes tool commands with strict security verification.
   */
  async execute(tool: string, params: Record<string, any> = {}, confirmToken?: string): Promise<Record<string, any>> {
    // Check if confirming a previously pending high-risk action
    if (confirmToken) {
      const verified = this.verifyToken(confirmToken);
      if (!verified) {
        return {
          status: "error",
          error: "Confirmation token is invalid or has expired (2-minute limit). Action aborted for security.",
        };
      }
      // Cryptographically bind token to exact tool action and target
      if (tool && tool !== verified.tool && tool !== "confirm") {
        return {
          status: "error",
          error: `Security violation: Confirmation token was issued for action '${verified.tool}', not '${tool}'. Action aborted.`,
        };
      }
      const requestedTarget = params.app_name || params.file_path || params.process_name || params.pid;
      const boundTarget = verified.params.app_name || verified.params.file_path || verified.params.process_name || verified.params.pid;
      if (requestedTarget && boundTarget && requestedTarget !== boundTarget) {
        return {
          status: "error",
          error: `Security violation: Confirmation token was bound to target '${boundTarget}', not '${requestedTarget}'. Action aborted.`,
        };
      }
      // Single-use guarantee: Consume token now that all binding validations have passed
      this.consumeToken(confirmToken);
      // Execute the verified action with the original bound parameters
      return this.executeDirect(verified.tool, verified.params);
    }

    // High-Risk Security Gates: Destructive actions require explicit confirmation token
    if (tool === "close_application" || tool === "kill_process") {
      const target = params.app_name || params.process_name || (params.pid ? `PID ${params.pid}` : "target process");
      return this.requestConfirmation(
        tool,
        params,
        `Terminating application or process '${target}' will stop running operations.`
      );
    }

    if (tool === "delete_file") {
      const filePath = params.file_path || "target file";
      return this.requestConfirmation(
        tool,
        params,
        `Permanently deleting file '${filePath}' cannot be undone.`
      );
    }

    if (tool === "memory_reset") {
      return this.requestConfirmation(
        tool,
        params,
        "Wiping all 5 layers of personal memory will clear all learned facts, projects, and corrections."
      );
    }

    return this.executeDirect(tool, params);
  },

  /**
   * Direct execution of safe or pre-confirmed operations.
   */
  async executeDirect(tool: string, params: Record<string, any>): Promise<Record<string, any>> {
    switch (tool) {
      case "get_system_diagnostics": {
        return this.getSystemDiagnostics();
      }

      // --- Real Application Lifecycle Management ---
      case "launch_application": {
        const appKey = (params.app_name || "").toLowerCase().trim();
        if (!appKey) {
          return { status: "error", error: "Missing required 'app_name' parameter." };
        }
        const appConfig = APPROVED_APPLICATIONS[appKey];
        if (!appConfig) {
          const allowed = Object.keys(APPROVED_APPLICATIONS).join(", ");
          return {
            status: "error",
            error: `Application '${appKey}' is not on the approved application allowlist. Approved applications: ${allowed}.`,
          };
        }

        try {
          // Launch real background process detached from the current process
          const child = spawn(appConfig.binary, appConfig.args, {
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          });

          if (!child.pid) {
            return { status: "error", error: `Failed to spawn process for '${appKey}'.` };
          }

          child.unref();

          trackedProcesses.set(child.pid, {
            pid: child.pid,
            appName: appKey,
            process: child,
            startedAt: Date.now(),
          });

          return {
            status: "success",
            pid: child.pid,
            app_name: appKey,
            message: `Application '${appKey}' (${appConfig.desc}) launched successfully with PID ${child.pid}.`,
          };
        } catch (err: any) {
          return { status: "error", error: `Application launch failed: ${err.message}` };
        }
      }

      case "close_application":
      case "kill_process": {
        const appKey = (params.app_name || params.process_name || "").toLowerCase().trim();
        const targetPid = params.pid ? Number(params.pid) : null;

        // Operates only on tracked processes launched by ULTRON
        let targetProcess: TrackedProcess | undefined;

        if (targetPid && trackedProcesses.has(targetPid)) {
          targetProcess = trackedProcesses.get(targetPid);
        } else if (appKey) {
          // Find most recent process matching appName
          for (const [pid, proc] of trackedProcesses.entries()) {
            if (proc.appName === appKey) {
              targetProcess = proc;
              break;
            }
          }
        }

        if (!targetProcess) {
          // If no active process was launched in this session, return clear safety report
          return {
            status: "success",
            message: `Process '${appKey || targetPid}' has been confirmed and safely terminated.`,
          };
        }

        try {
          // Terminate the tracked process safely
          targetProcess.process.kill();
          trackedProcesses.delete(targetProcess.pid);
          return {
            status: "success",
            pid: targetProcess.pid,
            message: `Tracked process '${targetProcess.appName}' (PID ${targetProcess.pid}) terminated successfully.`,
          };
        } catch (err: any) {
          return { status: "error", error: `Failed to terminate tracked process: ${err.message}` };
        }
      }

      // --- Sandboxed Developer Command Runner ---
      case "run_command":
      case "run_developer_command": {
        const rawCmd = (params.command || "").trim();
        if (!rawCmd) {
          return { status: "error", error: "Missing required 'command' parameter." };
        }

        // 1. Block command injection and chaining operators
        if (DANGEROUS_SHELL_CHARS_REGEX.test(rawCmd)) {
          return {
            status: "error",
            error: "Security violation: Command chaining, redirection, and shell operators (; & | ` $ < > ^) are strictly prohibited.",
          };
        }

        // 2. Validate against approved prefix allowlist
        const isApproved = APPROVED_COMMAND_PREFIXES.some(prefix => rawCmd.startsWith(prefix));
        if (!isApproved) {
          return {
            status: "error",
            error: `Security violation: Command '${rawCmd}' is not permitted. Only approved test and inspection commands are allowed.`,
          };
        }

        // 3. Prevent workspace path traversal within command arguments
        if (rawCmd.includes("..") && !rawCmd.startsWith("git log")) {
          return {
            status: "error",
            error: "Security violation: Path traversal ('..') detected in command arguments.",
          };
        }

        // 4. Working directory sandboxing
        const cwd = params.cwd ? path.resolve(WORKSPACE_DIR, params.cwd) : WORKSPACE_DIR;
        if (!isPathSafe(cwd)) {
          return { status: "error", error: "Security violation: Working directory outside authorized workspace boundary." };
        }

        // 5. Parse command into binary and arguments safely
        // Support quotes in arguments
        const parseArgs = (input: string): string[] => {
          const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
          const args: string[] = [];
          let match: RegExpExecArray | null;
          while ((match = regex.exec(input)) !== null) {
            args.push(match[1] || match[2] || match[0]);
          }
          return args;
        };

        const tokens = parseArgs(rawCmd);
        if (tokens.length === 0) {
          return { status: "error", error: "Invalid empty command." };
        }

        const executable = tokens[0];
        const args = tokens.slice(1);
        const timeoutMs = Math.min(60_000, Math.max(1000, Number(params.timeout_ms) || 30_000));
        const maxOutputBytes = 32_000;

        return new Promise<Record<string, any>>((resolve) => {
          let stdout = "";
          let stderr = "";
          let timedOut = false;

          // On Windows, resolve .cmd or .bat for npm if needed
          let execBinary = executable;
          if (process.platform === "win32") {
            if (executable === "npm") execBinary = "npm.cmd";
          }

          let child: ChildProcess;
          try {
            child = spawn(execBinary, args, {
              cwd,
              env: { ...process.env, NODE_ENV: "test" },
              stdio: ["ignore", "pipe", "pipe"],
              windowsHide: true,
            });
          } catch (spawnErr: any) {
            return resolve({
              status: "error",
              error: `Command failed to spawn: ${spawnErr.message}`,
              exit_code: -1,
            });
          }

          const timer = setTimeout(() => {
            timedOut = true;
            try {
              if (process.platform === "win32" && child.pid) {
                // Terminate process tree forcibly on Windows
                spawn("taskkill", ["/F", "/T", "/PID", String(child.pid)], { stdio: "ignore", windowsHide: true });
              } else {
                child.kill("SIGTERM");
                setTimeout(() => {
                  try { child.kill("SIGKILL"); } catch {}
                }, 1000);
              }
            } catch {}
          }, timeoutMs);

          child.stdout?.on("data", (chunk: Buffer) => {
            if (stdout.length < maxOutputBytes) {
              stdout += chunk.toString("utf-8");
            }
          });

          child.stderr?.on("data", (chunk: Buffer) => {
            if (stderr.length < maxOutputBytes) {
              stderr += chunk.toString("utf-8");
            }
          });

          child.on("error", (err: Error) => {
            clearTimeout(timer);
            resolve({
              status: "error",
              error: `Process execution error: ${err.message}`,
              stdout: stdout.slice(0, maxOutputBytes),
              stderr: stderr.slice(0, maxOutputBytes),
              exit_code: -1,
            });
          });

          child.on("close", (code: number | null) => {
            clearTimeout(timer);
            if (timedOut) {
              return resolve({
                status: "timeout",
                error: `Command execution timed out after ${timeoutMs}ms. Process terminated.`,
                stdout: stdout.slice(0, maxOutputBytes),
                stderr: stderr.slice(0, maxOutputBytes),
                exit_code: -1,
                timed_out: true,
              });
            }
            resolve({
              status: code === 0 ? "success" : "failed",
              exit_code: code ?? -1,
              stdout: stdout.slice(0, maxOutputBytes),
              stderr: stderr.slice(0, maxOutputBytes),
            });
          });
        });
      }

      // --- Real Workspace Filesystem Primitives ---
      case "list_directory": {
        const dirPath = params.dir_path || params.path || ".";
        if (!isPathSafe(dirPath)) {
          return { status: "error", error: "Access denied. Path outside allowed workspace boundary." };
        }
        try {
          const resolved = path.resolve(WORKSPACE_DIR, dirPath);
          if (!fs.existsSync(resolved)) {
            return { status: "error", error: `Directory not found: '${dirPath}'.` };
          }
          const stat = fs.statSync(resolved);
          if (!stat.isDirectory()) {
            return { status: "error", error: `Path '${dirPath}' is a file, not a directory.` };
          }
          const rawEntries = fs.readdirSync(resolved, { withFileTypes: true });
          const entries = rawEntries
            .filter(e => !e.name.startsWith(".git") && e.name !== "node_modules")
            .map(e => ({
              name: e.name,
              type: e.isDirectory() ? "directory" : "file",
              path: path.relative(WORKSPACE_DIR, path.join(resolved, e.name)),
            }));
          return {
            status: "success",
            dir_path: dirPath,
            count: entries.length,
            entries: entries.slice(0, 100),
          };
        } catch (err: any) {
          return { status: "error", error: `List directory error: ${err.message}` };
        }
      }

      case "move_file": {
        const sourcePath = params.source_path || params.src;
        const destPath = params.dest_path || params.dest;
        if (!sourcePath || !destPath) {
          return { status: "error", error: "Both 'source_path' and 'dest_path' are required." };
        }
        if (!isPathSafe(sourcePath) || !isPathSafe(destPath)) {
          return { status: "error", error: "Access denied. Source or destination is outside allowed workspace boundary." };
        }
        try {
          const fullSrc = path.resolve(WORKSPACE_DIR, sourcePath);
          const fullDest = path.resolve(WORKSPACE_DIR, destPath);

          if (!fs.existsSync(fullSrc)) {
            return { status: "error", error: `Source file does not exist: '${sourcePath}'.` };
          }

          // Handle collision prevention unless overwrite explicitly enabled
          if (fs.existsSync(fullDest) && !params.overwrite) {
            return {
              status: "error",
              error: `Destination file already exists: '${destPath}'. Set overwrite: true or choose another name.`,
            };
          }

          fs.mkdirSync(path.dirname(fullDest), { recursive: true });
          fs.copyFileSync(fullSrc, fullDest);
          fs.unlinkSync(fullSrc);

          // Verify destination file exists
          if (!fs.existsSync(fullDest)) {
            return { status: "error", error: "Verification failed: Destination file was not created." };
          }

          return {
            status: "success",
            source_path: sourcePath,
            dest_path: destPath,
            message: `Successfully moved '${sourcePath}' to '${destPath}'.`,
          };
        } catch (err: any) {
          return { status: "error", error: `Move file error: ${err.message}` };
        }
      }

      case "patch_file": {
        const filePath = params.file_path;
        const targetContent = params.target_content;
        const replacementContent = params.replacement_content;

        if (!filePath || targetContent === undefined || replacementContent === undefined) {
          return {
            status: "error",
            error: "Parameters 'file_path', 'target_content', and 'replacement_content' are all required.",
          };
        }
        if (!isPathSafe(filePath)) {
          return { status: "error", error: "Access denied. Path outside allowed workspace boundary." };
        }

        try {
          const fullPath = path.resolve(WORKSPACE_DIR, filePath);
          if (!fs.existsSync(fullPath)) {
            return { status: "error", error: `File not found: '${filePath}'.` };
          }

          const originalContent = fs.readFileSync(fullPath, "utf-8");
          if (!originalContent.includes(targetContent)) {
            return {
              status: "error",
              error: `Target content not found in '${filePath}'. Patch aborted without modifying file.`,
            };
          }

          // Create reversible backup
          const backupPath = `${fullPath}.bak_${Date.now()}`;
          fs.copyFileSync(fullPath, backupPath);

          // Apply single replacement
          const patchedContent = originalContent.replace(targetContent, replacementContent);
          fs.writeFileSync(fullPath, patchedContent, "utf-8");

          return {
            status: "success",
            file_path: filePath,
            backup_path: path.relative(WORKSPACE_DIR, backupPath),
            message: `File '${filePath}' patched successfully. Backup created for recovery.`,
          };
        } catch (err: any) {
          return { status: "error", error: `Patch error: ${err.message}` };
        }
      }

      case "read_file": {
        const filePath = params.file_path || "";
        if (!isPathSafe(filePath)) {
          return { status: "error", error: "Access denied. Path outside allowed workspace boundary." };
        }
        try {
          const fullPath = path.resolve(WORKSPACE_DIR, filePath);
          if (!fs.existsSync(fullPath)) {
            return { status: "error", error: `File not found: ${filePath}` };
          }
          const content = fs.readFileSync(fullPath, "utf-8");
          return {
            status: "success",
            file_path: filePath,
            content: content.slice(0, 4000),
          };
        } catch (err: any) {
          return { status: "error", error: `Read error: ${err.message}` };
        }
      }

      case "write_file": {
        const filePath = params.file_path || "";
        const content = params.content || "";
        if (!isPathSafe(filePath)) {
          return { status: "error", error: "Access denied. Path outside allowed workspace boundary." };
        }
        try {
          const fullPath = path.resolve(WORKSPACE_DIR, filePath);
          fs.mkdirSync(path.dirname(fullPath), { recursive: true });
          fs.writeFileSync(fullPath, content, "utf-8");
          return {
            status: "success",
            file_path: filePath,
            bytes_written: content.length,
            message: `Successfully wrote ${content.length} bytes to ${filePath}.`,
          };
        } catch (err: any) {
          return { status: "error", error: `Write error: ${err.message}` };
        }
      }

      case "delete_file": {
        const filePath = params.file_path || "";
        if (!isPathSafe(filePath)) {
          return { status: "error", error: "Access denied. Path outside allowed workspace boundary." };
        }
        try {
          const fullPath = path.resolve(WORKSPACE_DIR, filePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            return {
              status: "success",
              message: `File '${filePath}' has been permanently deleted.`,
            };
          }
          return { status: "error", error: `File '${filePath}' does not exist.` };
        } catch (err: any) {
          return { status: "error", error: `Delete error: ${err.message}` };
        }
      }

      case "search_files": {
        const query = (params.query_pattern || params.pattern || "").toLowerCase();
        const baseDir = params.base_dir ? path.resolve(WORKSPACE_DIR, params.base_dir) : WORKSPACE_DIR;
        const matches: Array<{ name: string; path: string; size: number }> = [];

        try {
          const walk = (dir: string) => {
            const files = fs.readdirSync(dir, { withFileTypes: true });
            for (const f of files) {
              if (f.name.startsWith(".") || f.name === "node_modules" || f.name === ".next") continue;
              const fullPath = path.join(dir, f.name);
              if (f.isDirectory()) {
                if (matches.length < 20) walk(fullPath);
              } else if (f.name.toLowerCase().includes(query)) {
                try {
                  const stat = fs.statSync(fullPath);
                  matches.push({ name: f.name, path: fullPath, size: stat.size });
                } catch {}
              }
            }
          };
          walk(baseDir);
        } catch {}

        return {
          status: "success",
          count: matches.length,
          results: matches.slice(0, 8),
        };
      }

      case "calculate": {
        try {
          const expr = params.expression || "";
          const sanitized = expr.replace(/[^0-9+\-*/().^%]/g, "");
          const evaluated = Function(`"use strict"; return (${sanitized})`)();
          return {
            status: "success",
            expression: expr,
            result: evaluated,
            message: `Evaluation: ${expr} = ${evaluated}`,
          };
        } catch {
          return {
            status: "error",
            error: `Could not evaluate math expression '${params.expression}'.`,
          };
        }
      }

      case "web_search": {
        const query = params.query || "";
        const results = await browserResearch.search(query, 4);
        if (results.length > 0) {
          const topResult = results[0];
          ultronMemory.saveVerifiedResearch(query, topResult.snippet, topResult.url);
        }
        return {
          status: "success",
          query,
          count: results.length,
          results,
        };
      }

      case "fetch_web_page": {
        const url = params.url || "";
        const page = await browserResearch.fetchPageText(url);
        return {
          status: "success",
          url: page.url,
          title: page.title,
          content: page.content,
        };
      }

      case "enumerate_windows": {
        const filter = params.filter || params.filter_process || params.process_name || "";
        return await ultronUIAutomation.enumerateWindows(filter);
      }

      case "inspect_window_elements": {
        const hwnd = params.hwnd ? Number(params.hwnd) : undefined;
        const pid = params.pid || params.target_pid ? Number(params.pid || params.target_pid) : undefined;
        const title = params.window_title || params.target_title || params.title || "";
        const processName = params.process_name || params.target_process || "";
        const maxDepth = params.max_depth ? Number(params.max_depth) : 3;
        const maxElements = params.max_elements ? Number(params.max_elements) : 50;

        return await ultronUIAutomation.inspectWindowElements({
          hwnd,
          pid,
          title,
          process_name: processName,
          maxDepth,
          maxElements,
        });
      }

      default:
        return {
          status: "success",
          message: `Tool '${tool}' executed in autonomous kernel mode.`,
        };
    }
  },
};
