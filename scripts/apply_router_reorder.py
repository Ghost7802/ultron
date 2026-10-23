import re

with open('lib/intentRouter.ts', 'r', encoding='utf-8') as f:
    text = f.read()

new_snippet = """  // 6a. Windows UI Automation: Discovery and Element Inspection (Prioritized ahead of app launch)
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
  }"""

pattern = re.compile(r'  // 6\. Direct Application Launch.*?  // 6b\. Windows UI Automation.*?\n  \}', re.DOTALL)
text = pattern.sub(lambda _: new_snippet, text, count=1)

with open('lib/intentRouter.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print('ROUTER_REORDERED_OK')
