/**
 * ULTRON Responsible Autonomy and Approval Policy (Module 4 & 6)
 * 
 * Implements 4-tier risk classification:
 * Level A: Observe (Inspect files, apps, system, logs) -> Unrestricted read-only
 * Level B: Recommend (Generate ideas, compare trade-offs, draft plans) -> Read-only reasoning
 * Level C: Safe Execution (Open apps, navigate, run harmless tests) -> Permitted on explicit user request
 * Level D: Approval Required (Destructive file ops, process kills, memory wipes, installs)
 *          -> Strict cryptographic HMAC-SHA256 token gate + parameter binding + single-use replay prevention
 */

import crypto from "crypto";

export type ExecutionRiskLevel = "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "LEVEL_D";

export interface ApprovalRequest {
  id: string;
  token: string;
  riskLevel: "LEVEL_D";
  actionName: string;
  targetParams: Record<string, any>;
  targetHash: string;
  whatWillChange: string;
  whyUseful: string;
  affectedResources: string[];
  risksAndRollback: string;
  verificationPlan: string;
  requestedAt: string;
  expiresAt: number;
  consumed: boolean;
}

// In-memory single-use approval registry
const activeApprovals = new Map<string, ApprovalRequest>();
const APPROVAL_EXPIRY_MS = 180_000; // 3 minutes

// Secure internal HMAC secret generated per runtime process (never logged or exposed in UI)
const RUNTIME_HMAC_SECRET = crypto.randomBytes(32);

function canonicalizeTarget(params: Record<string, any>): string {
  const keys = Object.keys(params).sort();
  const pairs = keys.map((k) => `${k}=${String(params[k]).trim().toLowerCase()}`);
  return pairs.join("|");
}

function computeHmacSignature(action: string, canonicalTarget: string, nonce: string, expiresAt: number): string {
  const payload = `${action}::${canonicalTarget}::${nonce}::${expiresAt}`;
  return crypto.createHmac("sha256", RUNTIME_HMAC_SECRET).update(payload).digest("hex");
}

export class ResponsibleAutonomyPolicy {
  /**
   * Classifies an operation or tool into its corresponding risk level.
   */
  static classifyRisk(toolName: string, params: Record<string, any> = {}): ExecutionRiskLevel {
    // Level D: Irreversible, destructive, or high-consequence operations
    if (
      toolName === "delete_file" ||
      toolName === "kill_process" ||
      toolName === "memory_reset" ||
      toolName === "install_package" ||
      toolName === "publish_external"
    ) {
      return "LEVEL_D";
    }

    // High-risk shell commands
    if (toolName === "run_command" || toolName === "run_developer_command") {
      const cmd = (params.command || "").toLowerCase();
      if (
        /\b(?:rmdir|del|rm -rf|format|reg delete|drop table|npm install -g|pip install)\b/i.test(cmd)
      ) {
        return "LEVEL_D";
      }
      return "LEVEL_C";
    }

    // Level C: Explicitly requested, low-risk, reversible actions
    if (
      toolName === "focus_window" ||
      toolName === "click_ui_element" ||
      toolName === "press_key" ||
      toolName === "type_text" ||
      toolName === "desktop_workflow" ||
      toolName === "browser_action" ||
      toolName === "calculate" ||
      toolName === "browse_web" ||
      toolName === "run_approved_fix"
    ) {
      return "LEVEL_C";
    }

    // Level A: Pure read-only observation & inspection
    if (
      toolName === "get_system_diagnostics" ||
      toolName === "enumerate_windows" ||
      toolName === "inspect_window_elements" ||
      toolName === "capture_screen" ||
      toolName === "analyze_screen" ||
      toolName === "read_file" ||
      toolName === "list_directory" ||
      toolName === "search_files" ||
      toolName === "web_search" ||
      toolName === "get_project_context" ||
      toolName === "scan_proactive_opportunities"
    ) {
      return "LEVEL_A";
    }

    // Level B: Recommendation / reasoning
    return "LEVEL_B";
  }

  /**
   * Generates a cryptographically sound Level D approval request with HMAC binding.
   */
  static createApprovalGate(details: {
    actionName: string;
    params?: Record<string, any>;
    whatWillChange: string;
    whyUseful: string;
    affectedResources: string[];
    risksAndRollback: string;
    verificationPlan: string;
  }): { requiresApproval: true; approvalRequest: ApprovalRequest; prompt: string } {
    const params = details.params || {};
    const canonicalTarget = canonicalizeTarget(params);
    const nonce = crypto.randomBytes(4).toString("hex").toUpperCase();
    const expiresAt = Date.now() + APPROVAL_EXPIRY_MS;

    const signature = computeHmacSignature(details.actionName, canonicalTarget, nonce, expiresAt);
    // Token incorporates the nonce and the cryptographic HMAC signature slice (64-bit entropy)
    const token = `${nonce}${signature.slice(0, 8)}`.toUpperCase();
    const id = `req_${Date.now()}_${nonce}`;

    const approvalRequest: ApprovalRequest = {
      id,
      token,
      riskLevel: "LEVEL_D",
      actionName: details.actionName,
      targetParams: params,
      targetHash: canonicalTarget,
      whatWillChange: details.whatWillChange,
      whyUseful: details.whyUseful,
      affectedResources: details.affectedResources,
      risksAndRollback: details.risksAndRollback,
      verificationPlan: details.verificationPlan,
      requestedAt: new Date().toISOString(),
      expiresAt,
      consumed: false,
    };

    activeApprovals.set(token, approvalRequest);

    const prompt =
      `⚠️ **Level D Consequential Action Approval Required**\n\n` +
      `• **Action:** ${details.actionName}\n` +
      `• **What Will Change:** ${details.whatWillChange}\n` +
      `• **Why It Is Useful:** ${details.whyUseful}\n` +
      `• **Affected Resources:** ${details.affectedResources.join(", ")}\n` +
      `• **Risks & Rollback:** ${details.risksAndRollback}\n` +
      `• **Verification Plan:** ${details.verificationPlan}\n\n` +
      `To authorize this execution, reply with confirmation token **${token}**.`;

    return {
      requiresApproval: true,
      approvalRequest,
      prompt,
    };
  }

  /**
   * Verifies an authorization token with cryptographic HMAC re-check, parameter matching, and replay prevention.
   */
  static verifyApprovalToken(
    token: string,
    actionName?: string,
    params?: Record<string, any>
  ): { valid: boolean; request?: ApprovalRequest; reason?: string } {
    if (!token || typeof token !== "string" || token.trim().length < 8) {
      return { valid: false, reason: "Malformed or missing confirmation token." };
    }

    const cleaned = token.trim().toUpperCase();
    const req = activeApprovals.get(cleaned);

    if (!req) {
      return { valid: false, reason: "Invalid or unrecognized confirmation token (reject closed)." };
    }

    // 1. Replay prevention check
    if (req.consumed) {
      activeApprovals.delete(cleaned);
      return { valid: false, reason: "Security violation: Replay attack detected. Token has already been consumed." };
    }

    // 2. Expiry check
    if (Date.now() > req.expiresAt) {
      activeApprovals.delete(cleaned);
      return { valid: false, reason: "Confirmation token has expired (3-minute TTL). Please re-request." };
    }

    // 3. Action binding check
    if (actionName && req.actionName !== actionName) {
      activeApprovals.delete(cleaned);
      return {
        valid: false,
        reason: `Security violation: Token was issued for action '${req.actionName}', not '${actionName}'. Action aborted.`,
      };
    }

    // 4. Parameter binding check (prevents parameter substitution / confusion attacks)
    if (params) {
      const candidateTarget = canonicalizeTarget(params);
      if (req.targetHash && req.targetHash !== candidateTarget) {
        activeApprovals.delete(cleaned);
        return {
          valid: false,
          reason: `Security violation: Token was bound to target '${req.targetHash}', but executed with '${candidateTarget}'. Action aborted.`,
        };
      }
    }

    // 5. Cryptographic signature re-verification
    const nonce = cleaned.slice(0, 8); // first 8 chars nonce
    const recomputedSig = computeHmacSignature(req.actionName, req.targetHash, nonce, req.expiresAt).slice(0, 8).toUpperCase();
    const expectedToken = `${nonce}${recomputedSig}`;

    const tokenBuf = Buffer.from(cleaned);
    const expectedBuf = Buffer.from(expectedToken);

    if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
      activeApprovals.delete(cleaned);
      return { valid: false, reason: "Cryptographic HMAC verification failed. Tampered token detected." };
    }

    // Mark consumed and permanently invalidate (Single-use)
    req.consumed = true;
    activeApprovals.delete(cleaned);

    return { valid: true, request: req };
  }

  /**
   * Resets active approvals (used in test cleanups).
   */
  static clearActiveApprovals(): void {
    activeApprovals.clear();
  }
}
