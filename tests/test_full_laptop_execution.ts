/**
 * ULTRON Full Laptop Access & Real Execution End-to-End Suite
 * Tests actual tools, browser navigation, window focusing, screen capture,
 * and dynamic application discovery against the live laptop environment.
 */

import { ultronTools, resolveInstalledApplication, BrowserApplicationController } from "../lib/ultronTools";
import { ultronUIAutomation } from "../lib/ultronUIAutomation";

async function runEndToEndTests() {
  console.log("=================================================");
  console.log("ULTRON REAL EXECUTION & FULL LAPTOP ACCESS SUITE");
  console.log("=================================================");

  const results: Record<string, any> = {};

  // 1. Dynamic Application Resolution
  console.log("\n[TEST 1] Dynamic Application Resolver");
  const chromeRes = await resolveInstalledApplication("chrome");
  const notepadRes = await resolveInstalledApplication("notepad");
  const edgeRes = await resolveInstalledApplication("edge");
  console.log("Chrome resolved:", chromeRes?.binary);
  console.log("Notepad resolved:", notepadRes?.binary);
  console.log("Edge resolved:", edgeRes?.binary);
  results["dynamic_app_resolution"] = {
    chrome: !!chromeRes?.binary,
    notepad: !!notepadRes?.binary,
    edge: !!edgeRes?.binary,
  };

  // 2. Real Screen Capture via GDI Desktop Attachment
  console.log("\n[TEST 2] Native Screen Capture");
  const capRes = await ultronTools.executeDirect("capture_screen", {});
  console.log("Capture Status:", capRes.status, "Mode:", capRes.mode, "Bytes:", capRes.size_bytes);
  console.log("Screenshot File:", capRes.file_path);
  results["screen_capture"] = {
    status: capRes.status,
    mode: capRes.mode,
    size_bytes: capRes.size_bytes,
  };

  // 3. Screen Analysis & Local Layout Comprehension
  console.log("\n[TEST 3] Screen Analysis Comprehension");
  const analRes = await ultronTools.executeDirect("analyze_screen", { query: "Identify open application windows" });
  console.log("Analysis Status:", analRes.status);
  console.log("Analysis Summary:", (analRes.analysis || "").split("\n")[0]);
  results["screen_analysis"] = {
    status: analRes.status,
    resolution: analRes.resolution,
  };

  // 4. Live Chrome Focusing & State Inspection
  console.log("\n[TEST 4] Real Chrome Browser Focus & Inspection");
  const focusRes = await BrowserApplicationController.executeBrowserAction({ action: "focus", browser: "chrome" });
  console.log("Browser Focus Status:", focusRes.status);
  console.log("Window Title:", focusRes.window_title, "PID:", focusRes.pid, "HWND:", focusRes.hwnd);
  results["browser_focus"] = {
    status: focusRes.status,
    title: focusRes.window_title,
    pid: focusRes.pid,
    hwnd: focusRes.hwnd,
  };

  // 5. Real Browser Navigation
  console.log("\n[TEST 5] Live Browser Navigation to Hacker News");
  const navRes = await BrowserApplicationController.executeBrowserAction({
    action: "navigate",
    url: "https://news.ycombinator.com",
    browser: "chrome",
  });
  console.log("Navigation Status:", navRes.status);
  console.log("Initial Title:", navRes.initial_title);
  console.log("Final Title:", navRes.final_title);
  results["browser_navigation"] = {
    status: navRes.status,
    url: navRes.target_url,
    initial_title: navRes.initial_title,
    final_title: navRes.final_title,
    title_verified: (navRes.final_title || "").toLowerCase().includes("hacker news"),
  };

  // 6. Real Browser Scroll Down & Up
  console.log("\n[TEST 6] Live Browser Scrolling");
  const scrollDownRes = await BrowserApplicationController.executeBrowserAction({ action: "scroll_down", browser: "chrome" });
  console.log("Scroll Down Status:", scrollDownRes.status, scrollDownRes.message);
  const scrollUpRes = await BrowserApplicationController.executeBrowserAction({ action: "scroll_up", browser: "chrome" });
  console.log("Scroll Up Status:", scrollUpRes.status, scrollUpRes.message);
  results["browser_scroll"] = {
    down: scrollDownRes.status,
    up: scrollUpRes.status,
  };

  // 7. Real Browser Refresh
  console.log("\n[TEST 7] Live Browser Page Refresh");
  const refreshRes = await BrowserApplicationController.executeBrowserAction({ action: "refresh", browser: "chrome" });
  console.log("Refresh Status:", refreshRes.status, refreshRes.message);
  results["browser_refresh"] = {
    status: refreshRes.status,
  };

  // 8. Launch Application (Focus Existing if open)
  console.log("\n[TEST 8] Launch Application (Intelligent Focus)");
  const launchChrome = await ultronTools.executeDirect("launch_application", { app_name: "chrome" });
  console.log("Launch Chrome Status:", launchChrome.status, "Action:", launchChrome.action);
  console.log("Message:", launchChrome.message);
  results["launch_existing_app"] = {
    status: launchChrome.status,
    action: launchChrome.action,
    pid: launchChrome.pid,
  };

  console.log("\n=================================================");
  console.log("ALL REAL EXECUTION TESTS COMPLETED");
  console.log("=================================================");
  console.log(JSON.stringify(results, null, 2));

  const fs = require("fs");
  fs.writeFileSync("tests/full_laptop_execution_results.json", JSON.stringify(results, null, 2));
}

runEndToEndTests().catch(console.error);

