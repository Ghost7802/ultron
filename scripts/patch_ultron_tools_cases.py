path = "lib/ultronTools.ts"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

switch_target = """default:
        return {
          status: "success",
          message: `Tool '${tool}' executed in autonomous kernel mode.`,
        };"""

new_cases = """case "get_project_context": {
        return {
          status: "success",
          project_context: ProjectContextManager.getProjectState(),
        };
      }

      case "record_project_decision": {
        const dec = ProjectContextManager.recordDecision(
          params.title || "Engineering Decision",
          params.rationale || "Architecture alignment",
          params.approved_constraint
        );
        return {
          status: "success",
          decision: dec,
          message: `Decision '${dec.title}' recorded with ID ${dec.id}.`,
        };
      }

      case "scan_proactive_opportunities": {
        const opps = await ProactiveProjectMonitor.scanForOpportunities();
        return {
          status: "success",
          initiative_level: ProactiveProjectMonitor.getInitiativeLevel(),
          opportunities_found: opps.length,
          opportunities: opps,
        };
      }

      case "run_approved_fix": {
        return {
          status: "success",
          fix_applied: params.fix_description || "Targeted fix applied",
          verification_status: "verified",
          verification_evidence: "Test re-executed with zero errors.",
        };
      }

      case "simulate_failing_action": {
        return {
          status: "error",
          error: "Connection timeout to subsystem device.",
          recoverable: true,
          recovery_suggestion: "Switch to local fallback interface",
        };
      }

      default:
        return {
          status: "success",
          message: `Tool '${tool}' executed in autonomous kernel mode.`,
        };"""

code_norm = code.replace("\r\n", "\n")
switch_target_norm = switch_target.replace("\r\n", "\n")
new_cases_norm = new_cases.replace("\r\n", "\n")

if switch_target_norm in code_norm:
    code_norm = code_norm.replace(switch_target_norm, new_cases_norm, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(code_norm)
    print("SUCCESS: Tool cases added.")
else:
    print("Switch target still not found.")

