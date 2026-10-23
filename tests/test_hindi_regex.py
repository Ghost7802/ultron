import re

noun_re = re.compile(r"\b(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\-_]+)\s+(?:kholo|chalao|open karo|start karo|launch karo|ko kholo|ko start karo)\b", re.I)
verb_re = re.compile(r"\b(?:open|launch|kholo|chalao|start)\s+(?!karo\b)(google chrome|chrome|edge|msedge|notepad|calculator|calc|vscode|code|explorer|files|taskmgr|cmd|terminal|powershell|vlc|spotify|[a-z0-9\-_]+)(?:\s+(?:app|application|program|window))?\b", re.I)

test_phrases = [
    "Google Chrome kholo",
    "Chrome kholo",
    "VLC kholo",
    "Notepad kholo",
    "open Google Chrome",
    "launch vlc",
    "kholo notepad",
    "chrome open karo",
    "spotify chalao",
    "open calculator"
]

for phrase in test_phrases:
    m = noun_re.search(phrase) or verb_re.search(phrase)
    app = m.group(1) if m else None
    print(f"'{phrase}' -> '{app}'")

