path = "lib/ultronAgentEngine.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

# Replace timeouts
code = code.replace(
    'const OVERALL_TIMEOUT_MS = 60_000; // 60s max for complete multi-step task\nconst PER_STEP_TIMEOUT_MS = 25_000; // 25s max per individual step',
    'const OVERALL_TIMEOUT_MS = 180_000; // 180s bounded total for multi-step tasks\nconst PER_STEP_TIMEOUT_MS = 75_000; // 75s budget per step for CPU LLM inference'
)

# Replace baseToolsListing with compact version
old_listing = '''function baseToolsListing(): string {
  const summaries = ULTRON_TOOLS.map((t) => {
    const params = Object.entries(t.parameters)
      .map(([name, s]) => `${name}${s.required ? " (required)" : ""}: ${s.type}`)
      .join(", ");
    return `- ${t.name}(${params}): ${t.description} [Risk: ${t.riskLevel}]`;
  });
  return "Available Tools:\\n" + summaries.join("\\n") + "\\n";
}'''

new_listing = '''function baseToolsListing(): string {
  // Concise tool descriptions to minimize prompt tokens on local CPU
  const coreTools = [
    "- launch_application(app_name: string): Launches or focuses desktop application (chrome, notepad, edge, etc.)",
    "- browser_control(action: string, url?: string, browser?: string): Controls browser (action: navigate, scroll_down, scroll_up, refresh, new_tab, switch_tab, get_state)",
    "- desktop_control(action: string, application?: string, text?: string): Controls desktop windows and types text",
    "- analyze_screen(query?: string): Captures and inspects current desktop layout, windows, and content",
    "- browse_web(url: string): Fetches text content from webpage URL",
    "- system_diagnostics(): Retrieves CPU, RAM, battery, and disk stats",
    "- manage_memory(operation: string, key?: string, value?: string): Saves or recalls permanent user facts",
    "- manage_files(operation: string, target_path: string, content?: string): File system operations"
  ];
  return "Available Tools:\\n" + coreTools.join("\\n") + "\\n";
}'''

code_norm = code.replace("\r\n", "\n")
old_listing_norm = old_listing.replace("\r\n", "\n")
new_listing_norm = new_listing.replace("\r\n", "\n")

if old_listing_norm in code_norm:
    code_norm = code_norm.replace(old_listing_norm, new_listing_norm, 1)
    print("Updated baseToolsListing to compact format")
else:
    print("Could not find old_listing in code")

with open(path, "w", encoding="utf-8") as f:
    f.write(code_norm)

print("Agent engine patched successfully")

