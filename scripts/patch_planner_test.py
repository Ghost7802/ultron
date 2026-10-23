"""Planner-test patch helper.

Responsibilities: update the test's import stubs to match the expanded tool graph.
Interaction: reads and writes ``tests/test_agent_planner.py`` in the repository.
Safety: writes only when the complete expected source fragment is present.
"""

import re

path = "tests/test_agent_planner.py"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

target = """    tools_code = re.sub(
        r'import\\s*\\{[^}]*\\}\\s*from\\s*["\']\\./ultronUIAutomation["\'];?',
        'const ultronUIAutomation = { enumerateWindows: async () => ({ status: "success", count: 1, windows: [] }), inspectWindowElements: async () => ({ status: "success", element_count: 1, elements: [] }) };',
        tools_code
    )"""

replacement = """    tools_code = re.sub(
        r'import\\s*\\{[^}]*\\}\\s*from\\s*["\']\\./ultronUIAutomation["\'];?',
        'const ultronUIAutomation = { enumerateWindows: async () => ({ status: "success", count: 1, windows: [] }), inspectWindowElements: async () => ({ status: "success", element_count: 1, elements: [] }) };',
        tools_code
    )
    tools_code = re.sub(r'import\\s*\\{[^}]*\\}\\s*from\\s*["\']\\./projectContext["\'];?', '', tools_code)
    tools_code = re.sub(r'import\\s*\\{[^}]*\\}\\s*from\\s*["\']\\./proactiveMonitor["\'];?', '', tools_code)
    tools_code = re.sub(r'import\\s*\\{[^}]*\\}\\s*from\\s*["\']\\./companionPersonality["\'];?', '', tools_code)
    tools_code = re.sub(r'import\\s*\\{[^}]*\\}\\s*from\\s*["\']\\./approvalPolicy["\'];?', '', tools_code)"""

code_norm = code.replace("\r\n", "\n")
target_norm = target.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

if target_norm in code_norm:
    code_norm = code_norm.replace(target_norm, replacement_norm, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(code_norm)
    print("SUCCESS: test_agent_planner.py patched.")
else:
    print("Target not found in test_agent_planner.py")
