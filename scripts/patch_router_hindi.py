with open('lib/intentRouter.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''  // 6. Direct Application Launch / Termination (Dynamic laptop discovery)
  const openAppMatch = lower.match(/\\b(?:open|launch|kholo|chalao|start)\\s+(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\\-_]+)(?:\\s+(?:app|application|program|window))?\\b/i);
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

  const closeAppMatch = lower.match(/\\b(?:close|band karo|hatao|kill|terminate)\\s+(notepad|calculator|calc|chrome|vscode|code|explorer|taskmgr)\\b/i);
  if (closeAppMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "close_application",
      toolParams: { app_name: closeAppMatch[1] },
      confidence: 0.98,
      reason: "High-risk application close requiring cryptographic confirmation gate",
    };
  }'''

replacement = '''  // 6. Direct Application Launch / Termination (Dynamic laptop discovery & Hindi/Hinglish phrasing)
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
  }'''

target_crlf = target.replace('\n', '\r\n')
replacement_crlf = replacement.replace('\n', '\r\n')

if target in text:
    text = text.replace(target, replacement, 1)
    print("PATCHED_LF")
elif target_crlf in text:
    text = text.replace(target_crlf, replacement_crlf, 1)
    print("PATCHED_CRLF")
else:
    print("NOT_FOUND")

with open('lib/intentRouter.ts', 'w', encoding='utf-8') as f:
    f.write(text)

