/**
 * ULTRON Smart Brain Intelligence & Desktop Access Evaluation Suite
 * 
 * Comprehensive empirical tests covering:
 * Part A: 12 Question-Understanding Categories
 * Part B: Real Desktop Application Access & 8-Step Verification Workflow
 */

import { QuestionUnderstandingEngine, type ConversationalTurn } from "../lib/questionUnderstanding";
import { routeUserQuery, ULTRON_TOOLS } from "../lib/intentRouter";
import { DesktopApplicationController } from "../lib/desktopController";
import { ultronUIAutomation } from "../lib/ultronUIAutomation";
import { ultronTools } from "../lib/ultronTools";
import { spawn } from "child_process";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  }
}

async function runQuestionUnderstandingTests() {
  console.log("\n========================================================");
  console.log("  PART A: QUESTION-UNDERSTANDING EVALUATION (12 CATEGORIES)");
  console.log("========================================================");

  // Category 1: Simple factual questions
  console.log("\n>> Category 1: Simple factual questions");
  const cat1 = QuestionUnderstandingEngine.parse("What is the speed of light in vacuum?");
  assert(cat1.intentType === "explanation" || cat1.intentType === "question", "Identified as explanation or question");
  assert(cat1.language === "en", "Language detected as English");
  assert(cat1.requirements.length === 1, "Single requirement extracted");

  // Category 2: Multi-part questions
  console.log("\n>> Category 2: Multi-part questions");
  const cat2 = QuestionUnderstandingEngine.parse("Check my CPU usage and list all open windows and search files for report.pdf");
  assert(cat2.requirements.length >= 2, `Decomposed into ${cat2.requirements.length} sub-requirements`);
  assert(cat2.intentType === "composite", "Intent type classified as composite");
  const route2 = routeUserQuery("Check my CPU usage and list all open windows");
  assert(route2.intent === "AGENT_PLAN", "Composite multi-part query routed to AGENT_PLAN loop");

  // Category 3: Hindi and Hinglish technical questions
  console.log("\n>> Category 3: Hindi and Hinglish technical questions");
  const cat3a = QuestionUnderstandingEngine.parse("Mera CPU aur RAM usage check karke actual status batao na");
  assert(cat3a.language === "hinglish", "Detected as Hinglish");
  const cat3b = QuestionUnderstandingEngine.parse("सिस्टम का स्टेटस रिपोर्ट बताओ");
  assert(cat3b.language === "hi", "Detected as Hindi");

  // Category 4: Follow-up questions with pronouns and references
  console.log("\n>> Category 4: Follow-up questions with pronouns and references");
  const history: ConversationalTurn[] = [
    { role: "user", content: "List all open windows on my desktop." },
    {
      role: "assistant",
      content: 'Discovered 2 active desktop windows:\n• [PID 1234] "Notepad - notes.txt" (notepad.exe) - HWND: 65538\n• [PID 5678] "Calculator" (calc.exe) - HWND: 131074',
    },
  ];
  const cat4 = QuestionUnderstandingEngine.parse("Focus the first window and type hello", history);
  assert(cat4.resolvedRequest.includes("Notepad") || cat4.resolvedEntities.targetWindow === "Notepad - notes.txt", "Resolved 'the first window' to Notepad");
  assert(cat4.resolvedEntities.targetPid === 1234, "Resolved target PID 1234 from prior assistant message");

  // Category 5: Corrections to earlier statements
  console.log("\n>> Category 5: Corrections to earlier statements");
  const cat5 = QuestionUnderstandingEngine.parse("Actually remember that my preferred editor is VS Code, not Sublime");
  assert(cat5.resolvedRequest.includes("preferred editor is VS Code"), "Extracted corrected preference text");
  const route5 = routeUserQuery("Remember that my preferred editor is VS Code");
  assert(route5.intent === "MEMORY_OP", "Memory correction routed to MEMORY_OP");

  // Category 6: Questions containing explicit constraints
  console.log("\n>> Category 6: Questions containing explicit constraints");
  const cat6 = QuestionUnderstandingEngine.parse("Do not touch the UI, work offline only, and check system status in English");
  assert(cat6.constraints.includes("DO_NOT_TOUCH_UI"), "Extracted DO_NOT_TOUCH_UI constraint");
  assert(cat6.constraints.includes("STRICT_OFFLINE"), "Extracted STRICT_OFFLINE constraint");
  assert(cat6.constraints.includes("LANGUAGE_ENGLISH"), "Extracted LANGUAGE_ENGLISH constraint");

  // Category 7: Ambiguous instructions
  console.log("\n>> Category 7: Ambiguous instructions");
  const cat7 = QuestionUnderstandingEngine.parse("Delete the file");
  assert(cat7.intentType === "clarification_needed", "Classified as clarification_needed");
  assert(Boolean(cat7.clarificationPrompt?.includes("Which file")), "Generated targeted clarification prompt for missing filename");
  const route7 = routeUserQuery("Delete the file");
  assert(Boolean(route7.intent === "SYSTEM_LOCAL" && route7.fastLocalResponse?.includes("specify the exact file")), "Route returned clarification response directly");

  // Category 8: Questions requiring actual system telemetry
  console.log("\n>> Category 8: Questions requiring actual system telemetry");
  const route8 = routeUserQuery("Mera CPU aur RAM usage check karke actual status batao");
  assert(route8.intent === "TOOL_CALL" && route8.toolRequired === "get_system_diagnostics", "Live telemetry routed to get_system_diagnostics");

  // Category 9: Questions requiring project-file inspection
  console.log("\n>> Category 9: Questions requiring project-file inspection");
  const route9 = routeUserQuery("read file package.json");
  assert(route9.intent === "TOOL_CALL" && route9.toolRequired === "read_file", "File inspection routed to read_file");

  // Category 10: Questions requiring research and evidence
  console.log("\n>> Category 10: Questions requiring research and evidence");
  const route10 = routeUserQuery("search the web for Quantum Computing breakthroughs");
  assert(route10.intent === "TOOL_CALL" && route10.toolRequired === "web_search", "Research routed to web_search");

  // Category 11: Questions requiring a multi-step action
  console.log("\n>> Category 11: Questions requiring a multi-step action");
  const route11 = routeUserQuery("mere project ko test karke errors fix karo");
  assert(route11.intent === "AGENT_PLAN", "Multi-step repair task routed to AGENT_PLAN");

  // Category 12: Questions requiring cryptographic confirmation
  console.log("\n>> Category 12: Questions requiring cryptographic confirmation");
  const route12 = routeUserQuery("delete file important_doc.txt");
  assert(route12.intent === "TOOL_CALL" && route12.toolRequired === "delete_file", "Destructive file deletion identified");
  const res12 = await ultronTools.execute("delete_file", { file_path: "important_doc.txt" });
  assert(res12.status === "confirmation_required", "Cryptographic confirmation gate enforced on destructive deletion");
}

async function runDesktopIntegrationTests() {
  console.log("\n========================================================");
  console.log("  PART B: REAL DESKTOP APPLICATION ACCESS & VERIFICATION");
  console.log("========================================================");

  // Test 1: Window Discovery
  console.log("\n>> Desktop Test 1: Window Discovery");
  const enumResult = await ultronUIAutomation.enumerateWindows();
  assert(enumResult.status === "success", "Window enumeration returned success");
  assert(Array.isArray(enumResult.windows) && enumResult.windows.length > 0, `Discovered ${enumResult.windows?.length || 0} active top-level windows`);
  console.log(`     Top window: "${enumResult.windows?.[0]?.title}" (${enumResult.windows?.[0]?.process_name})`);

  // Test 2: Launch disposable test window (Calculator)
  console.log("\n>> Desktop Test 2: Launch disposable test application (Calculator)");
  const launchRes = await ultronTools.execute("launch_application", { app_name: "calc" });
  assert(launchRes.status === "success", "Calculator launched successfully");
  const calcPid = launchRes.pid;
  console.log(`     Calculator launched with PID: ${calcPid}`);

  // Allow window to initialize on desktop
  await sleep(2000);

  try {
    // Test 3: Application Discovery & Targeting
    console.log("\n>> Desktop Test 3: Target Application Discovery (Calculator)");
    const discovery = await DesktopApplicationController.discoverTargetWindow({ application: "calc" });
    assert(discovery.matched !== null, `Discovered Calculator window: "${discovery.matched?.title}" (HWND ${discovery.matched?.hwnd})`);
    const calcHwnd = discovery.matched?.hwnd;

    // Test 4: Focus Application Window
    console.log("\n>> Desktop Test 4: Focus Application Window");
    const focusWorkflow = await DesktopApplicationController.executeApplicationWorkflow("focus", {
      application: "calc",
      targetHwnd: calcHwnd,
    });
    assert(focusWorkflow.status === "success", "Focus workflow reported success");
    assert(focusWorkflow.verification.verified, "Window focus verified in foreground");

    // Test 5: Inspect Accessible Elements & Controls
    console.log("\n>> Desktop Test 5: Inspect Accessible Controls Hierarchy");
    const inspectWorkflow = await DesktopApplicationController.executeApplicationWorkflow("inspect", {
      application: "calc",
      targetHwnd: calcHwnd,
    });
    assert(inspectWorkflow.status === "success", "Inspection workflow reported success");
    assert(inspectWorkflow.verification.verified, "Controls hierarchy enumerated");

    // Test 6: Button / Key Invocation (Send ENTER or ESC key to Calculator)
    console.log("\n>> Desktop Test 6: Keyboard Key Delivery & Verification");
    const keyWorkflow = await DesktopApplicationController.executeApplicationWorkflow(
      "press_key",
      { application: "calc", targetHwnd: calcHwnd },
      { key: "ENTER" }
    );
    assert(keyWorkflow.status === "success", "Key delivery reported success");
    assert(keyWorkflow.verification.verified, `Key delivery verified: ${keyWorkflow.verification.evidence}`);

    // Test 7: Target Existing VS Code Window Focus & Verification
    console.log("\n>> Desktop Test 7: Focus & Verify VS Code Application");
    const vscodeFocus = await DesktopApplicationController.executeApplicationWorkflow("focus", {
      application: "code",
    });
    assert(vscodeFocus.status === "success", "VS Code focus reported success");
    assert(vscodeFocus.verification.verified, `VS Code focus verified: ${vscodeFocus.verification.evidence}`);

    // Test 8: Ambiguous / Missing Application Recovery
    console.log("\n>> Desktop Test 8: Application-Not-Found Graceful Recovery");
    const missingWorkflow = await DesktopApplicationController.executeApplicationWorkflow("focus", {
      application: "non_existent_app_9999",
    });
    assert(missingWorkflow.status === "not_found", "Gracefully returned 'not_found' status without crashing");
    assert(Boolean(missingWorkflow.error?.includes("not currently running")), "Returned clear explanatory error message");

    // Test 9: Stale / Closed Window Recovery
    console.log("\n>> Desktop Test 9: Invalid / Closed Window Handle Recovery");
    const invalidHwndWorkflow = await DesktopApplicationController.executeApplicationWorkflow("focus", {
      targetHwnd: 99999999,
    });
    assert(invalidHwndWorkflow.status === "not_found", "Handled invalid HWND safely");

  } finally {
    // Cleanup disposable Calculator process
    console.log("\n>> Cleanup: Terminating disposable test Calculator window");
    try {
      spawn("taskkill.exe", ["/F", "/IM", "CalculatorApp.exe"], { stdio: "ignore" });
    } catch {}
    console.log("     Test process cleaned up successfully.");
  }
}

async function main() {
  const start = performance.now();
  console.log("================================================================");
  console.log("  ULTRON SMART BRAIN & DESKTOP ACCESS MASTER VERIFICATION SUITE");
  console.log("================================================================");

  try {
    await runQuestionUnderstandingTests();
    await runDesktopIntegrationTests();

    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log("\n================================================================");
    console.log(`  EVALUATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%) in ${elapsed}s`);
    console.log("================================================================\n");
    process.exit(0);
  } catch (err: any) {
    console.error("\n[EVALUATION FAILED]", err);
    process.exit(1);
  }
}

main();
