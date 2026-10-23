with open('lib/ultronTools.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''        // 3. Fallback: native Windows UI Automation comprehension
        if (!visionAnalysis) {
          const winList = await ultronUIAutomation.enumerateWindows();
          const activeWins = winList.windows ? winList.windows.slice(0, 5) : [];
          const topWin = activeWins[0];
          let topElements: any[] = [];
          if (topWin && topWin.hwnd) {
            const elemRes = await ultronUIAutomation.inspectWindowElements({ hwnd: topWin.hwnd, maxDepth: 2, maxElements: 12 });
            topElements = elemRes.elements || [];
          }

          const winSummary = activeWins.map((w: any) => `'${w.title}' (${w.process_name}, PID: ${w.pid})`).join(", ");
          const elemSummary = topElements.map((e: any) => `${e.control_type || 'Control'}: "${e.name || e.automation_id || 'unnamed'}"`).join("; ");

          visionAnalysis = `[Local Desktop Vision Analysis]\\nScreen Resolution: ${captureRes.width}x${captureRes.height} (${captureRes.mode || 'surface'}).\\nForeground/Active Windows: ${winSummary || 'Desktop Workspace'}.\\nVisible Interactive Elements: ${elemSummary || 'Standard desktop controls'}.\\nStatus: Local layout comprehension verified without cloud dependencies.`;
        }

        return {
          status: "success",
          analysis: visionAnalysis,
          screenshot_path: filePath,
          resolution: `${captureRes.width}x${captureRes.height}`,
          mode: captureRes.mode,
          timestamp: Date.now(),
        };'''

replacement = '''        // 3. Transparent Fallback: Native Windows UI Automation structural inspection
        let analysisType = "local_vision_model";
        let modelUsed: string | null = null;

        if (visionAnalysis) {
          modelUsed = "local_ollama_vision";
        } else {
          analysisType = "structural_uia_inspection";
          const winList = await ultronUIAutomation.enumerateWindows();
          const activeWins = winList.windows ? winList.windows.slice(0, 5) : [];
          const topWin = activeWins[0];
          let topElements: any[] = [];
          if (topWin && topWin.hwnd) {
            const elemRes = await ultronUIAutomation.inspectWindowElements({ hwnd: topWin.hwnd, maxDepth: 2, maxElements: 12 });
            topElements = elemRes.elements || [];
          }

          const winSummary = activeWins.map((w: any) => `'${w.title}' (${w.process_name}, PID: ${w.pid})`).join(", ");
          const elemSummary = topElements.map((e: any) => `${e.control_type || 'Control'}: "${e.name || e.automation_id || 'unnamed'}"`).join("; ");

          visionAnalysis = `[Desktop Structural Inspection (UI Automation Tree)]\\n(Notice: No local Ollama vision model is currently installed. To enable direct pixel neural vision without cloud dependencies, install 'moondream' via 'ollama pull moondream' [1.6B params, ~820MB, fits available RAM]).\\nCaptured Screenshot: ${filePath}\\nResolution: ${captureRes.width}x${captureRes.height} (${captureRes.mode || 'real_desktop_gdi'}).\\nForeground/Active Windows: ${winSummary || 'Desktop Workspace'}.\\nVisible Interactive Controls: ${elemSummary || 'Standard desktop controls'}.\\nStatus: Desktop structure read directly via Windows Accessibility interfaces.`;
        }

        return {
          status: "success",
          analysis_type: analysisType,
          model_used: modelUsed,
          vision_model_installed: analysisType === "local_vision_model",
          recommended_vision_model: "moondream (1.6B parameters, ~820MB, optimized for 8GB RAM host)",
          analysis: visionAnalysis,
          screenshot_path: filePath,
          resolution: `${captureRes.width}x${captureRes.height}`,
          mode: captureRes.mode,
          timestamp: Date.now(),
        };'''

target_crlf = target.replace('\n', '\r\n')
replacement_crlf = replacement.replace('\n', '\r\n')

if target in text:
    text = text.replace(target, replacement, 1)
    print("PATCHED_HONEST_VISION_LF")
elif target_crlf in text:
    text = text.replace(target_crlf, replacement_crlf, 1)
    print("PATCHED_HONEST_VISION_CRLF")
else:
    print("NOT_FOUND")

with open('lib/ultronTools.ts', 'w', encoding='utf-8') as f:
    f.write(text)

