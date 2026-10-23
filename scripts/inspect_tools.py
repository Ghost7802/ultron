import re

text = open("lib/ultronTools.ts", encoding="utf-8").read()
tool_names = re.findall(r'name:\s*"([^"]+)"', text)
print("Tools in ultronTools.ts:")
for t in set(tool_names):
    print(" -", t)

