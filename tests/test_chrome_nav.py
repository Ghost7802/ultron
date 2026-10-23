"""
Test script for real Chrome browser interaction and verification
"""
import subprocess
import json
import time

def run_action(action, **kwargs):
    cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "lib/scripts/windows_action.ps1", "-Action", action]
    for k, v in kwargs.items():
        cmd.extend([f"-{k}", str(v)])
    res = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(res.stdout.strip())
    except Exception as e:
        return {"status": "error", "raw": res.stdout, "err": str(e)}

def test_chrome_control():
    # 1. Focus Chrome
    f_res = run_action("focus", TargetHwnd=67020)
    print("1. Focus:", f_res.get("status"), "Foreground:", f_res.get("verification", {}).get("is_foreground"))

    time.sleep(0.5)

    # 2. Type URL into Address Bar
    t_res = run_action("type", Text="https://en.wikipedia.org", TargetHwnd=67020)
    print("2. Type URL:", t_res.get("status"), "Method:", t_res.get("verification", {}).get("method_used"))

    time.sleep(0.5)

    # 3. Press ENTER
    k2_res = run_action("presskey", Key="ENTER", TargetHwnd=67020)
    print("3. Press ENTER:", k2_res.get("status"))

    # 4. Wait for page load
    time.sleep(3.0)

    # 5. Check window title via UI Automation enumerate
    cmd = ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "lib/scripts/windows_uia.ps1", "-Action", "enumerate"]
    res = subprocess.run(cmd, capture_output=True, text=True)
    win_data = json.loads(res.stdout.strip())
    chrome_win = next((w for w in win_data.get("windows", []) if w.get("hwnd") == 67020 or "chrome" in w.get("process_name", "").lower()), None)

    title = chrome_win.get("title", "") if chrome_win else ""
    print("4. Chrome Window Title after navigation:", repr(title))

    is_wiki = "wikipedia" in title.lower()
    print("Navigation Verified:", is_wiki)
    return is_wiki

if __name__ == "__main__":
    test_chrome_control()
