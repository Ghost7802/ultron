path = "lib/ultronTools.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

bad_imports = """import { ProjectContextManager } from "./projectContext";
import { ProactiveProjectMonitor } from "./proactiveMonitor";"""

code = code.replace(bad_imports + "\n", "")
code = code.replace(bad_imports, "")

with open(path, "w", encoding="utf-8") as f:
    f.write(code)
print("Removed imports from ultronTools.ts")

