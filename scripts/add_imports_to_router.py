path = "lib/intentRouter.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

imports = """import { CompanionPersonalityEngine, type ToneAnalysis } from "./companionPersonality";
import { ProjectContextManager } from "./projectContext";
import { ResponsibleAutonomyPolicy, type ExecutionRiskLevel } from "./approvalPolicy";
import { ProactiveProjectMonitor } from "./proactiveMonitor";
"""

target = "export interface ConversationalTurn {"
if target in code and "import { CompanionPersonalityEngine" not in code:
    code = code.replace(target, imports + "\n" + target, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(code)
    print("SUCCESS: Imports inserted.")
else:
    print("Already inserted or target not found.")

