"""
Final precision patches for:
1. lib/intentRouter.ts: windowEnumMatch prioritized ahead of openAppMatch
2. lib/ultronTools.ts: type_text confirmation gate restored for direct document typing
"""

# Patch 1: lib/intentRouter.ts
with open('lib/intentRouter.ts', 'r', encoding='utf-8') as f:
    router_text = f.read()

old_block = '''  // 6. Direct Application Launch / Termination (Dynamic laptop discovery & Hindi/Hinglish phrasing)
  const nounFirstOpen = lower.match(/\\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)\\s+(?:kholo|chalao|open karo|start karo|launch karo|ko kholo|ko start karo)\\b/i);
  const verbFirstOpen = lower.match(/\\b(?:open|launch|kholo|chalao|start)\\s+(?!karo\\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)(?:\\s+(?:app|application|program|window))?\\b/i);
  const openAppMatch = nounFirstOpen || verbFirstOpen;

  if (openAppMatch) {
    const rawName = openAppMatch[1].trim();
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "launch_application",
      toolParams: { app_name: rawName },
      confidence: 0.98,
      reason: "Dynamic desktop application launch/focus",
    };
  }

  const nounFirstClose = lower.match(/\\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)\\s+(?:band karo|hatao|kill karo|close karo|terminate karo)\\b/i);
  const verbFirstClose = lower.match(/\\b(?:close|band karo|hatao|kill|terminate)\\s+(?!karo\\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)\\b/i);
  const closeAppMatch = nounFirstClose || verbFirstClose;

  if (closeAppMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "close_application",
      toolParams: { app_name: closeAppMatch[1].trim() },
      confidence: 0.98,
      reason: "High-risk application close requiring cryptographic confirmation gate",
    };
  }

  // 6b. Windows UI Automation: Discovery and Element Inspection (Phase 3A - Strictly Read-Only)
  const windowEnumMatch = lower.match(/\\b(?:list (?:all\\s+|open\\s+|active\\s+)*windows|what windows are open|show (?:all\\s+|active\\s+|open\\s+)*windows|enumerate windows|kaunse windows khule hain)\\b/i);
  if (windowEnumMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "enumerate_windows",
      toolParams: {},
      confidence: 0.99,
      reason: "Enumerate active Windows top-level windows",
    };
  }'''

new_block = '''  // 6a. Windows UI Automation: Discovery and Element Inspection (Prioritized ahead of app launch)
  const windowEnumMatch = lower.match(/\\b(?:list (?:all\\s+|open\\s+|active\\s+)*windows|what windows are open|show (?:all\\s+|active\\s+|open\\s+)*windows|enumerate windows|kaunse windows khule hain)\\b/i);
  if (windowEnumMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "enumerate_windows",
      toolParams: {},
      confidence: 0.99,
      reason: "Enumerate active Windows top-level windows",
    };
  }

  // 6b. Direct Application Launch / Termination (Dynamic laptop discovery & Hindi/Hinglish phrasing)
  const isWindowListingQuery = /\\b(?:list|show|what|enumerate)\\b/i.test(lower);
  const nounFirstOpen = !isWindowListingQuery && lower.match(/\\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)\\s+(?:kholo|chalao|open karo|start karo|launch karo|ko kholo|ko start karo)\\b/i);
  const verbFirstOpen = !isWindowListingQuery && lower.match(/\\b(?:open|launch|kholo|chalao|start)\\s+(?!karo\\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)(?:\\s+(?:app|application|program|window))?\\b/i);
  const openAppMatch = nounFirstOpen || verbFirstOpen;

  if (openAppMatch) {
    const rawName = openAppMatch[1].trim();
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "launch_application",
      toolParams: { app_name: rawName },
      confidence: 0.98,
      reason: "Dynamic desktop application launch/focus",
    };
  }

  const nounFirstClose = lower.match(/\\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)\\s+(?:band karo|hatao|kill karo|close karo|terminate karo)\\b/i);
  const verbFirstClose = lower.match(/\\b(?:close|band karo|hatao|kill|terminate)\\s+(?!karo\\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)\\b/i);
  const closeAppMatch = nounFirstClose || verbFirstClose;

  if (closeAppMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "close_application",
      toolParams: { app_name: closeAppMatch[1].trim() },
      confidence: 0.98,
      reason: "High-risk application close requiring cryptographic confirmation gate",
    };
  }'''

if old_block in router_text:
    router_text = router_text.replace(old_block, new_block, 1)
    with open('lib/intentRouter.ts', 'w', encoding='utf-8') as f:
        f.write(router_text)
    print("ROUTER_PATCHED_OK")
else:
    print("ROUTER_BLOCK_NOT_FOUND")

# Patch 2: lib/ultronTools.ts (restore type_text confirmation gate for direct document typing)
with open('lib/ultronTools.ts', 'r', encoding='utf-8') as f:
    tools_text = f.read()

old_tools_gate = '''    if (tool === "memory_reset") {
      return this.requestConfirmation(
        tool,
        params,
        "Wiping all 5 layers of personal memory will clear all learned facts, projects, and corrections."
      );
    }

    // Consequential UI Element Clicks'''

new_tools_gate = '''    if (tool === "memory_reset") {
      return this.requestConfirmation(
        tool,
        params,
        "Wiping all 5 layers of personal memory will clear all learned facts, projects, and corrections."
      );
    }

    // Phase 3B UI Actions: Sending text to user document requires confirmation
    if (tool === "type_text" && !params.skip_confirmation) {
      const winTarget = params.window_title || params.target_title || params.process_name || (params.hwnd ? `HWND ${params.hwnd}` : (params.pid ? `PID ${params.pid}` : "target window"));
      const elTarget = params.element_name || params.automation_id || "editable control";
      const previewText = (params.text || "").length > 40 ? (params.text || "").slice(0, 37) + "..." : (params.text || "");
      return this.requestConfirmation(
        tool,
        params,
        `Typing text "${previewText}" into '${elTarget}' in window '${winTarget}'.`
      );
    }

    // Consequential UI Element Clicks'''

if old_tools_gate in tools_text:
    tools_text = tools_text.replace(old_tools_gate, new_tools_gate, 1)
    with open('lib/ultronTools.ts', 'w', encoding='utf-8') as f:
        f.write(tools_text)
    print("TOOLS_GATE_PATCHED_OK")
else:
    print("TOOLS_GATE_NOT_FOUND")

