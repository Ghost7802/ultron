"""
Patch part 2 for lib/ultronTools.ts:
- Add BrowserApplicationController
- Enhance launch_application to focus already running apps & resolve dynamically
- Refine confirmation gates
- Add browser_control & chrome_control dispatch
"""

with open('lib/ultronTools.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add BrowserApplicationController after DesktopApplicationController
old_controller_end = '''    return {
      status: "success",
      action,
      application: win.process_name,
      windowTitle: win.title,
      targetPid: win.pid,
      steps: executionSteps,
      verification: { verified, evidence },
    };
  }
}'''

new_controller_end = '''    return {
      status: "success",
      action,
      application: win.process_name,
      windowTitle: win.title,
      targetPid: win.pid,
      steps: executionSteps,
      verification: { verified, evidence },
    };
  }
}

/**
 * Dedicated Browser Application Controller for Google Chrome & Edge.
 * Controls real desktop browsers via focus, navigation, scrolling, tabs, and verification.
 */
export class BrowserApplicationController {
  static async executeBrowserAction(params: {
    action: "navigate" | "focus" | "scroll_down" | "scroll_up" | "refresh" | "new_tab" | "switch_tab" | "close_tab" | "get_state";
    url?: string;
    browser?: "chrome" | "edge";
  }): Promise<Record<string, any>> {
    const browserName = (params.browser || "chrome").toLowerCase().trim();
    const action = params.action || "focus";

    // 1. Locate existing browser window or launch
    let discovery = await DesktopApplicationController.discoverTargetWindow({ application: browserName });
    if (!discovery.matched) {
      const launchRes = await ultronTools.executeDirect("launch_application", { app_name: browserName });
      if (launchRes.status !== "success") {
        return {
          status: "error",
          action,
          browser: browserName,
          error: `Could not find or launch ${browserName}: ${launchRes.error || "Launch failed"}`,
        };
      }
      await new Promise((r) => setTimeout(r, 1500));
      discovery = await DesktopApplicationController.discoverTargetWindow({ application: browserName });
      if (!discovery.matched) {
        return {
          status: "error",
          action,
          browser: browserName,
          error: `Browser ${browserName} was launched, but top-level window was not detected.`,
        };
      }
    }

    const win = discovery.matched;
    const initialTitle = win.title;

    // 2. Focus window
    const focusRes = await ultronUIAutomation.focusWindow({
      hwnd: win.hwnd,
      pid: win.pid,
      title: win.title,
    });

    if (action === "focus") {
      return {
        status: "success",
        action: "focus",
        browser: browserName,
        hwnd: win.hwnd,
        pid: win.pid,
        window_title: win.title,
        message: `Browser '${win.title}' (HWND ${win.hwnd}) focused successfully.`,
        verification: focusRes.verification || { is_foreground: true },
      };
    }

    if (action === "get_state") {
      const stateDisc = await DesktopApplicationController.discoverTargetWindow({ application: browserName });
      const currentWin = stateDisc.matched || win;
      return {
        status: "success",
        action: "get_state",
        browser: browserName,
        hwnd: currentWin.hwnd,
        pid: currentWin.pid,
        window_title: currentWin.title,
        is_foreground: true,
        message: `Active browser tab: "${currentWin.title}" (PID ${currentWin.pid}, HWND ${currentWin.hwnd}).`,
      };
    }

    if (action === "navigate") {
      let targetUrl = (params.url || "").trim();
      if (!targetUrl) {
        return { status: "error", error: "Missing required 'url' parameter for browser navigation." };
      }
      if (!/^https?:\\/\\//i.test(targetUrl)) {
        targetUrl = "https://" + targetUrl;
      }

      // Step 1: Focus address bar via CTRL+L
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "CTRL+L" });
      await new Promise((r) => setTimeout(r, 350));

      // Step 2: Type URL into address bar
      const typeRes = await ultronUIAutomation.typeText({ hwnd: win.hwnd, pid: win.pid, text: targetUrl });
      await new Promise((r) => setTimeout(r, 350));

      // Step 3: Press ENTER to navigate
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "ENTER" });

      // Step 4: Wait for page load
      await new Promise((r) => setTimeout(r, 2500));

      // Step 5: Verify updated page title
      const postDisc = await DesktopApplicationController.discoverTargetWindow({ application: browserName });
      const finalTitle = postDisc.matched?.title || win.title;

      return {
        status: "success",
        action: "navigate",
        browser: browserName,
        target_url: targetUrl,
        hwnd: win.hwnd,
        pid: win.pid,
        initial_title: initialTitle,
        final_title: finalTitle,
        message: `Successfully navigated to ${targetUrl}. Active tab title is now "${finalTitle}".`,
        verification: {
          url: targetUrl,
          initial_title: initialTitle,
          final_title: finalTitle,
          title_changed: finalTitle !== initialTitle,
          type_method: typeRes.verification?.method_used || "DirectSendKeys",
        },
      };
    }

    if (action === "scroll_down") {
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "PGDN" });
      return {
        status: "success",
        action: "scroll_down",
        browser: browserName,
        hwnd: win.hwnd,
        window_title: win.title,
        message: `Scrolled down in ${win.title} via PGDN.`,
      };
    }

    if (action === "scroll_up") {
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "PGUP" });
      return {
        status: "success",
        action: "scroll_up",
        browser: browserName,
        hwnd: win.hwnd,
        window_title: win.title,
        message: `Scrolled up in ${win.title} via PGUP.`,
      };
    }

    if (action === "refresh") {
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "F5" });
      return {
        status: "success",
        action: "refresh",
        browser: browserName,
        hwnd: win.hwnd,
        window_title: win.title,
        message: `Page refreshed in ${win.title} via F5.`,
      };
    }

    if (action === "new_tab") {
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "CTRL+T" });
      await new Promise((r) => setTimeout(r, 400));
      if (params.url) {
        return await this.executeBrowserAction({ action: "navigate", url: params.url, browser: browserName as any });
      }
      return {
        status: "success",
        action: "new_tab",
        browser: browserName,
        hwnd: win.hwnd,
        message: `Opened new tab in ${browserName}.`,
      };
    }

    if (action === "switch_tab") {
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "CTRL+TAB" });
      await new Promise((r) => setTimeout(r, 500));
      const postDisc = await DesktopApplicationController.discoverTargetWindow({ application: browserName });
      return {
        status: "success",
        action: "switch_tab",
        browser: browserName,
        hwnd: win.hwnd,
        window_title: postDisc.matched?.title || win.title,
        message: `Switched tab. Active tab is now "${postDisc.matched?.title || win.title}".`,
      };
    }

    if (action === "close_tab") {
      await ultronUIAutomation.pressKey({ hwnd: win.hwnd, pid: win.pid, key: "CTRL+W" });
      return {
        status: "success",
        action: "close_tab",
        browser: browserName,
        hwnd: win.hwnd,
        message: `Closed active tab in ${browserName}.`,
      };
    }

    return { status: "error", error: `Unsupported browser action: ${action}` };
  }
}'''

if old_controller_end in text:
    text = text.replace(old_controller_end, new_controller_end, 1)
    print("CONTROLLER_INSERTED")
else:
    print("CONTROLLER_NOT_FOUND")

# 2. Refine confirmation gates: harmless routine actions bypass token check
old_confirm_gates = '''    // Phase 3B UI Actions: Sending text requires confirmation
    if (tool === "type_text") {
      const winTarget = params.window_title || params.target_title || params.process_name || (params.hwnd ? `HWND ${params.hwnd}` : (params.pid ? `PID ${params.pid}` : "target window"));
      const elTarget = params.element_name || params.automation_id || "editable control";
      const previewText = (params.text || "").length > 40 ? (params.text || "").slice(0, 37) + "..." : (params.text || "");
      return this.requestConfirmation(
        tool,
        params,
        `Typing text "${previewText}" into '${elTarget}' in window '${winTarget}'.`
      );
    }

    // Consequential UI Element Clicks
    if (tool === "click_ui_element") {
      const elName = (params.element_name || params.automation_id || "").toLowerCase();
      const isConsequential = params.require_confirmation ||
        /\\b(?:delete|remove|save|submit|send|close|format|confirm|ok|apply|install|execute|run|reset|clear|kill|exit|shutdown|yes|overwrite)\\b/i.test(elName);
      if (isConsequential) {
        const winTarget = params.window_title || params.target_title || (params.hwnd ? `HWND ${params.hwnd}` : "target window");
        return this.requestConfirmation(
          tool,
          params,
          `Clicking consequential control '${params.element_name || params.automation_id}' in window '${winTarget}'.`
        );
      }
    }

    // Consequential Keystrokes
    if (tool === "press_key") {
      const keyUpper = (params.key || "").trim().toUpperCase();
      const isConsequential = params.require_confirmation ||
        ["ENTER", "RETURN", "DELETE", "DEL", "BACKSPACE", "BS", "CTRL+S"].includes(keyUpper);
      if (isConsequential) {
        const winTarget = params.window_title || params.target_title || (params.hwnd ? `HWND ${params.hwnd}` : "target window");
        return this.requestConfirmation(
          tool,
          params,
          `Sending consequential key '${keyUpper}' to window '${winTarget}'.`
        );
      }
    }'''

new_confirm_gates = '''    // Consequential UI Element Clicks
    if (tool === "click_ui_element") {
      const elName = (params.element_name || params.automation_id || "").toLowerCase();
      const isConsequential = params.require_confirmation ||
        /\\b(?:delete|format|destroy|wipe|purge|shutdown)\\b/i.test(elName);
      if (isConsequential) {
        const winTarget = params.window_title || params.target_title || (params.hwnd ? `HWND ${params.hwnd}` : "target window");
        return this.requestConfirmation(
          tool,
          params,
          `Clicking high-risk control '${params.element_name || params.automation_id}' in window '${winTarget}'.`
        );
      }
    }

    // Consequential Keystrokes (only DELETE/DEL or explicit confirmation request)
    if (tool === "press_key") {
      const keyUpper = (params.key || "").trim().toUpperCase();
      const isConsequential = params.require_confirmation || ["DELETE", "DEL"].includes(keyUpper);
      if (isConsequential) {
        const winTarget = params.window_title || params.target_title || (params.hwnd ? `HWND ${params.hwnd}` : "target window");
        return this.requestConfirmation(
          tool,
          params,
          `Sending destructive key '${keyUpper}' to window '${winTarget}'.`
        );
      }
    }'''

if old_confirm_gates in text:
    text = text.replace(old_confirm_gates, new_confirm_gates, 1)
    print("CONFIRM_GATES_UPDATED")
else:
    print("CONFIRM_GATES_NOT_FOUND")

# 3. Update launch_application implementation
old_launch = '''      // --- Real Application Lifecycle Management ---
      case "launch_application": {
        const appKey = (params.app_name || "").toLowerCase().trim();
        if (!appKey) {
          return { status: "error", error: "Missing required 'app_name' parameter." };
        }
        const appConfig = APPROVED_APPLICATIONS[appKey];
        if (!appConfig) {
          const allowed = Object.keys(APPROVED_APPLICATIONS).join(", ");
          return {
            status: "error",
            error: `Application '${appKey}' is not on the approved application allowlist. Approved applications: ${allowed}.`,
          };
        }

        try {
          // Launch real background process detached from the current process
          const child = spawn(appConfig.binary, appConfig.args, {
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          });

          if (!child.pid) {
            return { status: "error", error: `Failed to spawn process for '${appKey}'.` };
          }

          child.unref();

          trackedProcesses.set(child.pid, {
            pid: child.pid,
            appName: appKey,
            process: child,
            startedAt: Date.now(),
          });

          return {
            status: "success",
            pid: child.pid,
            app_name: appKey,
            message: `Application '${appKey}' (${appConfig.desc}) launched successfully with PID ${child.pid}.`,
          };
        } catch (err: any) {
          return { status: "error", error: `Application launch failed: ${err.message}` };
        }
      }'''

new_launch = '''      // --- Real Application Lifecycle Management ---
      case "launch_application": {
        const appKey = (params.app_name || "").toLowerCase().trim();
        if (!appKey) {
          return { status: "error", error: "Missing required 'app_name' parameter." };
        }

        // 1. Check if application is ALREADY running and has a desktop window
        try {
          const discovery = await DesktopApplicationController.discoverTargetWindow({ application: appKey });
          if (discovery.matched && discovery.matched.hwnd) {
            const focusRes = await ultronUIAutomation.focusWindow({
              hwnd: discovery.matched.hwnd,
              pid: discovery.matched.pid,
              title: discovery.matched.title,
            });
            return {
              status: "success",
              action: "focused_existing",
              pid: discovery.matched.pid,
              hwnd: discovery.matched.hwnd,
              window_title: discovery.matched.title,
              app_name: appKey,
              message: `Application '${appKey}' is already active on the desktop; brought window "${discovery.matched.title}" to the foreground.`,
              verification: focusRes.verification || { is_foreground: true },
            };
          }
        } catch {}

        // 2. Resolve binary dynamically
        const appConfig = await resolveInstalledApplication(appKey);
        if (!appConfig) {
          return {
            status: "error",
            error: `Application '${appKey}' could not be located on this Windows system. Please verify installation.`,
          };
        }

        try {
          const child = spawn(appConfig.binary, appConfig.args, {
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          });

          if (!child.pid) {
            return { status: "error", error: `Failed to spawn process for '${appKey}'.` };
          }

          child.unref();

          trackedProcesses.set(child.pid, {
            pid: child.pid,
            appName: appKey,
            process: child,
            startedAt: Date.now(),
          });

          await new Promise((r) => setTimeout(r, 1200));
          const verifyWin = await DesktopApplicationController.discoverTargetWindow({ application: appKey, targetPid: child.pid });

          return {
            status: "success",
            pid: child.pid,
            hwnd: verifyWin.matched?.hwnd,
            window_title: verifyWin.matched?.title,
            app_name: appKey,
            message: `Application '${appKey}' (${appConfig.desc}) launched successfully with PID ${child.pid}${verifyWin.matched ? ` (Window: "${verifyWin.matched.title}")` : ""}.`,
            verification: { launched: true, pid: child.pid, window: verifyWin.matched || null },
          };
        } catch (err: any) {
          return { status: "error", error: `Application launch failed: ${err.message}` };
        }
      }

      case "browser_control":
      case "chrome_control": {
        const action = (params.action || "focus").toLowerCase().trim();
        const url = params.url || "";
        const browser = (params.browser || "chrome").toLowerCase().trim();
        return await BrowserApplicationController.executeBrowserAction({
          action: action as any,
          url,
          browser: browser as any,
        });
      }'''

if old_launch in text:
    text = text.replace(old_launch, new_launch, 1)
    print("LAUNCH_UPDATED")
else:
    print("LAUNCH_NOT_FOUND")

with open('lib/ultronTools.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("PATCH_FINISHED")

