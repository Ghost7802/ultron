"""
Patch lib/intentRouter.ts to support:
1. browser_control in SYSTEM_TOOLS
2. dedicated browser navigation & control intents
3. dynamic application launch for all installed applications
"""

with open('lib/intentRouter.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add browser_control tool definition in SYSTEM_TOOLS
target_tools = '''  {
    name: "launch_application",
    description: "Launches a Windows desktop application (e.g. notepad, calc, chrome, vscode, taskmgr, explorer)",
    riskLevel: "SAFE",
    parameters: {
      app_name: {
        type: "string",
        description: "Name of the application to open",
        required: true,
      },
    },
  },'''

new_tools = '''  {
    name: "launch_application",
    description: "Launches a Windows desktop application (e.g. notepad, calc, chrome, vscode, taskmgr, explorer)",
    riskLevel: "SAFE",
    parameters: {
      app_name: {
        type: "string",
        description: "Name of the application to open",
        required: true,
      },
    },
  },
  {
    name: "browser_control",
    description: "Controls Google Chrome or Edge: navigate to URLs, scroll up/down, refresh, switch tabs, new tab, focus, or get page state",
    riskLevel: "SAFE",
    parameters: {
      action: {
        type: "string",
        description: "Browser action: 'navigate', 'focus', 'scroll_down', 'scroll_up', 'refresh', 'new_tab', 'switch_tab', 'close_tab', 'get_state'",
        required: true,
      },
      url: {
        type: "string",
        description: "Target URL to navigate to",
      },
      browser: {
        type: "string",
        description: "Target browser: 'chrome' or 'edge'",
      },
    },
  },'''

if target_tools in text:
    text = text.replace(target_tools, new_tools, 1)
    print("TOOLS_UPDATED")
else:
    print("TOOLS_NOT_FOUND")

# 2. Add browser control and dynamic app launch in intent routing
target_routing = '''  // 6. Direct Application Launch / Termination
  const openAppMatch = lower.match(/\\b(?:open|launch|kholo|chalao|start)\\s+(notepad|calculator|calc|chrome|vscode|code|explorer|taskmgr)\\b/i);
  if (openAppMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "launch_application",
      toolParams: { app_name: openAppMatch[1] },
      confidence: 0.98,
      reason: "Direct desktop application launch",
    };
  }'''

new_routing = '''  // 5b. Dedicated Real Browser Control (Google Chrome / Edge)
  const navUrlMatch = lower.match(/\\b(?:navigate to|go to|open url|open website)\\s+([a-zA-Z0-9\\-\\._~:\\/\\?#\\[\\]@!\\$&'\\(\\)\\*\\+,;=]+)(?:\\s+(?:in|on)\\s+(chrome|edge|browser))?/i);
  if (navUrlMatch) {
    const rawUrl = navUrlMatch[1].trim();
    const browser = (navUrlMatch[2] || "chrome").toLowerCase();
    const finalUrl = /^https?:\\/\\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "navigate", url: finalUrl, browser },
      confidence: 0.98,
      reason: "Real browser URL navigation and state verification",
    };
  }

  const openInBrowserMatch = lower.match(/\\b(?:open|launch)\\s+(?:google\\s+)?(chrome|edge)\\s+(?:and\\s+)?(?:go to|open|navigate to)\\s+(.+)/i);
  if (openInBrowserMatch) {
    const browser = openInBrowserMatch[1].toLowerCase();
    const rawUrl = openInBrowserMatch[2].trim();
    const finalUrl = /^https?:\\/\\//i.test(rawUrl) ? rawUrl : "https://" + rawUrl;
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "navigate", url: finalUrl, browser },
      confidence: 0.98,
      reason: "Launch browser and navigate to target URL",
    };
  }

  const scrollBrowserMatch = lower.match(/\\b(?:scroll down|page down|scroll niche)\\s*(?:in|on)?\\s*(chrome|edge|browser|page)?\\b/i);
  if (scrollBrowserMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "scroll_down", browser: (scrollBrowserMatch[1] || "chrome").toLowerCase() },
      confidence: 0.96,
      reason: "Scroll down in browser page",
    };
  }

  const scrollUpBrowserMatch = lower.match(/\\b(?:scroll up|page up|scroll upar)\\s*(?:in|on)?\\s*(chrome|edge|browser|page)?\\b/i);
  if (scrollUpBrowserMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "scroll_up", browser: (scrollUpBrowserMatch[1] || "chrome").toLowerCase() },
      confidence: 0.96,
      reason: "Scroll up in browser page",
    };
  }

  const refreshBrowserMatch = lower.match(/\\b(?:refresh|reload|f5)\\s*(?:chrome|edge|browser|page|tab)?\\b/i);
  if (refreshBrowserMatch && !lower.includes("memory") && !lower.includes("system")) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "refresh", browser: "chrome" },
      confidence: 0.95,
      reason: "Refresh browser page",
    };
  }

  const switchTabMatch = lower.match(/\\b(?:switch tab|next tab|change tab)\\s*(?:in|on)?\\s*(chrome|edge|browser)?\\b/i);
  if (switchTabMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "switch_tab", browser: (switchTabMatch[1] || "chrome").toLowerCase() },
      confidence: 0.96,
      reason: "Switch browser tab",
    };
  }

  const browserStateMatch = lower.match(/\\b(?:what is on (?:chrome|edge|browser)|check (?:chrome|edge|browser)|chrome screen|browser screen)\\b/i);
  if (browserStateMatch) {
    return {
      intent: "TOOL_CALL",
      targetModel: "local-rule",
      toolRequired: "browser_control",
      toolParams: { action: "get_state", browser: "chrome" },
      confidence: 0.96,
      reason: "Inspect active browser tab state",
    };
  }

  // 6. Direct Application Launch / Termination (Dynamic laptop discovery)
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
  }'''

if target_routing in text:
    text = text.replace(target_routing, new_routing, 1)
    print("ROUTING_UPDATED")
else:
    print("ROUTING_NOT_FOUND")

with open('lib/intentRouter.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("INTENT_ROUTER_PATCH_FINISHED")

