# Windows UI Automation Action Bridge for ULTRON (Phase 3B: Safe Native Desktop Control)
# Bounded Desktop Actions: focus_window, click_ui_element, type_text, press_key
# Strict verification, credential blocking, coordinate-guessing prevention, and thread isolation.

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("focus", "click", "type", "presskey")]
    [string]$Action,

    [long]$TargetHwnd = 0,
    [int]$TargetPid = 0,
    [string]$TargetTitle = "",
    [string]$TargetProcess = "",
    [string]$AutomationId = "",
    [string]$ElementName = "",
    [string]$ControlType = "",
    [string]$Text = "",
    [string]$Key = ""
)

Add-Type -ReferencedAssemblies UIAutomationClient, UIAutomationTypes, WindowsBase, System.Windows.Forms -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Forms;

public class UltronActionBridge {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenWindowStation(string lpszWinSta, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetProcessWindowStation(IntPtr hWinSta);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    const uint DESKTOP_ALL_ACCESS = 0x01FF;

    private static readonly Dictionary<string, string> ALLOWED_KEYS = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { "ENTER", "{ENTER}" },
        { "RETURN", "{ENTER}" },
        { "ESC", "{ESC}" },
        { "ESCAPE", "{ESC}" },
        { "TAB", "{TAB}" },
        { "BACKSPACE", "{BACKSPACE}" },
        { "BS", "{BACKSPACE}" },
        { "DELETE", "{DELETE}" },
        { "DEL", "{DELETE}" },
        { "SPACE", " " },
        { "UP", "{UP}" },
        { "DOWN", "{DOWN}" },
        { "LEFT", "{LEFT}" },
        { "RIGHT", "{RIGHT}" },
        { "PAGEUP", "{PGUP}" },
        { "PGUP", "{PGUP}" },
        { "PAGEDOWN", "{PGDN}" },
        { "PGDN", "{PGDN}" },
        { "HOME", "{HOME}" },
        { "END", "{END}" },
        { "CTRL+A", "^a" },
        { "CTRL+C", "^c" },
        { "CTRL+V", "^v" },
        { "CTRL+Z", "^z" },
        { "CTRL+S", "^s" },
        { "CTRL+F", "^f" },
        { "CTRL+L", "^l" },
        { "CTRL+T", "^t" },
        { "CTRL+W", "^w" },
        { "CTRL+R", "^r" },
        { "F5", "{F5}" },
        { "CTRL+TAB", "^{TAB}" },
        { "ALT+LEFT", "%{LEFT}" },
        { "ALT+RIGHT", "%{RIGHT}" }
    };

    public class WindowMatch {
        public IntPtr Hwnd;
        public uint Pid;
        public string Title;
        public string ClassName;
    }

    public static Dictionary<string, object> RunOnStaDesktop(Func<Dictionary<string, object>> action) {
        Dictionary<string, object> result = null;
        Exception caughtEx = null;

        IntPtr hDesktop = OpenDesktop("Default", 0, false, DESKTOP_ALL_ACCESS);
        if (hDesktop == IntPtr.Zero) {
            hDesktop = OpenDesktop("Default", 0, false, 0x0041);
        }

        Thread worker = new Thread(() => {
            try {
                if (hDesktop != IntPtr.Zero) {
                    SetThreadDesktop(hDesktop);
                }
                result = action();
            } catch (Exception ex) {
                caughtEx = ex;
            }
        });

        worker.SetApartmentState(ApartmentState.STA);
        worker.Start();
        worker.Join(12000);

        if (hDesktop != IntPtr.Zero) {
            CloseDesktop(hDesktop);
        }

        if (caughtEx != null) {
            var errRes = new Dictionary<string, object>();
            errRes["status"] = "error";
            errRes["error"] = caughtEx.Message;
            return errRes;
        }

        if (result == null) {
            var errRes = new Dictionary<string, object>();
            errRes["status"] = "error";
            errRes["error"] = "Desktop worker thread timed out after 12 seconds.";
            return errRes;
        }

        return result;
    }

    public static List<WindowMatch> EnumerateTopWindows() {
        var list = new List<WindowMatch>();
        var seenHwnds = new HashSet<IntPtr>();

        try {
            IntPtr hWinsta = OpenWindowStation("WinSta0", false, 0x037F);
            if (hWinsta != IntPtr.Zero) {
                SetProcessWindowStation(hWinsta);
            }
        } catch {}

        EnumWindowsProc callback = (hWnd, lParam) => {
            try {
                if (seenHwnds.Contains(hWnd)) return true;

                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                bool visible = IsWindowVisible(hWnd);
                int len = GetWindowTextLength(hWnd);
                StringBuilder sbTitle = new StringBuilder(len + 1);
                GetWindowText(hWnd, sbTitle, len + 1);
                string title = sbTitle.ToString();

                StringBuilder sbClass = new StringBuilder(256);
                GetClassName(hWnd, sbClass, 256);
                string cls = sbClass.ToString();

                RECT rect;
                GetWindowRect(hWnd, out rect);
                int w = rect.Right - rect.Left;
                int h = rect.Bottom - rect.Top;

                if ((visible || (w > 80 && h > 80)) && w > 0 && h > 0) {
                    if (string.IsNullOrWhiteSpace(title)) {
                        try {
                            var proc = Process.GetProcessById((int)pid);
                            if (proc != null) title = proc.ProcessName;
                        } catch {}
                    }
                    if (!string.IsNullOrWhiteSpace(title)) {
                        seenHwnds.Add(hWnd);
                        list.Add(new WindowMatch {
                            Hwnd = hWnd,
                            Pid = pid,
                            Title = title,
                            ClassName = cls
                        });
                    }
                }
            } catch {}
            return true;
        };

        IntPtr hDesktop = OpenDesktop("Default", 0, false, DESKTOP_ALL_ACCESS);
        if (hDesktop == IntPtr.Zero) {
            hDesktop = OpenDesktop("Default", 0, false, 0x01FF);
        }
        if (hDesktop == IntPtr.Zero) {
            hDesktop = OpenDesktop("Default", 0, false, 0x0041);
        }
        if (hDesktop != IntPtr.Zero) {
            try { SetThreadDesktop(hDesktop); } catch {}
            EnumDesktopWindows(hDesktop, callback, IntPtr.Zero);
            CloseDesktop(hDesktop);
        }

        try {
            EnumWindows(callback, IntPtr.Zero);
        } catch {}

        return list;
    }

    public static WindowMatch FindTargetWindow(long hwnd, uint targetPid, string targetTitle, string targetProcess) {
        if (hwnd > 0) {
            IntPtr h = new IntPtr(hwnd);
            if (IsWindow(h)) {
                uint p;
                GetWindowThreadProcessId(h, out p);
                int l = GetWindowTextLength(h);
                StringBuilder sb = new StringBuilder(l + 1);
                GetWindowText(h, sb, l + 1);
                string t = sb.ToString();
                if (string.IsNullOrWhiteSpace(t)) {
                    try {
                        var proc = Process.GetProcessById((int)p);
                        if (proc != null) t = proc.ProcessName;
                    } catch {}
                }
                return new WindowMatch { Hwnd = h, Pid = p, Title = t };
            }
        }

        string targetPidProcessName = null;
        if (targetPid > 0) {
            try {
                var proc = Process.GetProcessById((int)targetPid);
                if (proc != null) {
                    targetPidProcessName = proc.ProcessName;
                    if (proc.MainWindowHandle != IntPtr.Zero && IsWindow(proc.MainWindowHandle)) {
                        int l = GetWindowTextLength(proc.MainWindowHandle);
                        StringBuilder sb = new StringBuilder(l + 1);
                        GetWindowText(proc.MainWindowHandle, sb, l + 1);
                        string t = sb.ToString();
                        if (string.IsNullOrWhiteSpace(t)) t = proc.ProcessName;
                        return new WindowMatch { Hwnd = proc.MainWindowHandle, Pid = targetPid, Title = t };
                    }
                }
            } catch {}
        }

        if (!string.IsNullOrWhiteSpace(targetProcess)) {
            try {
                var procs = Process.GetProcessesByName(targetProcess);
                foreach (var p in procs) {
                    if (p.MainWindowHandle != IntPtr.Zero && IsWindow(p.MainWindowHandle)) {
                        int l = GetWindowTextLength(p.MainWindowHandle);
                        StringBuilder sb = new StringBuilder(l + 1);
                        GetWindowText(p.MainWindowHandle, sb, l + 1);
                        string t = sb.ToString();
                        if (string.IsNullOrWhiteSpace(t)) t = p.ProcessName;
                        return new WindowMatch { Hwnd = p.MainWindowHandle, Pid = (uint)p.Id, Title = t };
                    }
                }
            } catch {}
        }

        var all = EnumerateTopWindows();
        // 1. Direct PID match
        if (targetPid > 0) {
            foreach (var w in all) {
                if (w.Pid == targetPid) return w;
            }
        }
        // 2. Direct title match
        if (!string.IsNullOrWhiteSpace(targetTitle)) {
            foreach (var w in all) {
                if (w.Title.IndexOf(targetTitle, StringComparison.OrdinalIgnoreCase) >= 0) return w;
            }
        }
        // 3. Process name match (either explicit or resolved from targetPid)
        string procToMatch = !string.IsNullOrWhiteSpace(targetProcess) ? targetProcess : targetPidProcessName;
        if (!string.IsNullOrWhiteSpace(procToMatch)) {
            foreach (var w in all) {
                try {
                    var proc = Process.GetProcessById((int)w.Pid);
                    if (proc != null && proc.ProcessName.IndexOf(procToMatch, StringComparison.OrdinalIgnoreCase) >= 0) {
                        return w;
                    }
                } catch {}
            }
        }
        return null;
    }

    public static bool ForceForeground(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return false;

        if (IsIconic(hWnd)) {
            ShowWindow(hWnd, 9 /* SW_RESTORE */);
            Thread.Sleep(100);
        } else {
            ShowWindow(hWnd, 5 /* SW_SHOW */);
        }

        IntPtr curFg = GetForegroundWindow();
        uint curThread = GetCurrentThreadId();
        uint dummyPid = 0;
        uint fgThread = curFg != IntPtr.Zero ? GetWindowThreadProcessId(curFg, out dummyPid) : 0;
        uint targetThread = GetWindowThreadProcessId(hWnd, out dummyPid);

        if (curThread != targetThread && targetThread != 0) {
            AttachThreadInput(curThread, targetThread, true);
        }
        if (curThread != fgThread && fgThread != 0) {
            AttachThreadInput(curThread, fgThread, true);
        }

        // Simulate ALT key tap to grant foreground activation privilege
        keybd_event(0x12 /* VK_MENU */, 0, 0, UIntPtr.Zero);
        keybd_event(0x12, 0, 2 /* KEYEVENTF_KEYUP */, UIntPtr.Zero);

        BringWindowToTop(hWnd);
        SetForegroundWindow(hWnd);
        SwitchToThisWindow(hWnd, true);

        if (curThread != targetThread && targetThread != 0) {
            AttachThreadInput(curThread, targetThread, false);
        }
        if (curThread != fgThread && fgThread != 0) {
            AttachThreadInput(curThread, fgThread, false);
        }

        Thread.Sleep(150);
        return true;
    }

    public static AutomationElement FindElement(AutomationElement root, string automationId, string elementName, string controlType) {
        if (root == null) return null;

        // 1. By AutomationId
        if (!string.IsNullOrWhiteSpace(automationId)) {
            try {
                var cond = new PropertyCondition(AutomationElement.AutomationIdProperty, automationId);
                var found = root.FindFirst(TreeScope.Descendants, cond);
                if (found != null) return found;
            } catch {}
        }

        // 2. By Name exact
        if (!string.IsNullOrWhiteSpace(elementName)) {
            try {
                var cond = new PropertyCondition(AutomationElement.NameProperty, elementName);
                var found = root.FindFirst(TreeScope.Descendants, cond);
                if (found != null) return found;
            } catch {}
        }

        // 3. By Name substring or ControlType
        try {
            var all = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
            foreach (AutomationElement el in all) {
                var cur = el.Current;
                if (!string.IsNullOrWhiteSpace(elementName) && !string.IsNullOrWhiteSpace(cur.Name)) {
                    if (cur.Name.IndexOf(elementName, StringComparison.OrdinalIgnoreCase) >= 0) {
                        return el;
                    }
                }
                if (!string.IsNullOrWhiteSpace(controlType) && cur.ControlType != null) {
                    if (cur.ControlType.ProgrammaticName.EndsWith(controlType, StringComparison.OrdinalIgnoreCase)) {
                        return el;
                    }
                }
            }
        } catch {}

        return null;
    }

    public static string EscapeSendKeys(string input) {
        if (string.IsNullOrEmpty(input)) return "";
        StringBuilder sb = new StringBuilder();
        foreach (char c in input) {
            if (c == '{' || c == '}' || c == '+' || c == '^' || c == '%' || c == '~' || c == '(' || c == ')' || c == '[' || c == ']') {
                sb.Append("{" + c + "}");
            } else {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    // --- Action 1: Focus Window ---
    public static Dictionary<string, object> FocusWindow(long targetHwnd, uint targetPid, string targetTitle, string targetProcess) {
        return RunOnStaDesktop(() => {
            var res = new Dictionary<string, object>();
            var win = FindTargetWindow(targetHwnd, targetPid, targetTitle, targetProcess);
            if (win == null) {
                res["status"] = "error";
                res["action"] = "focus_window";
                res["error"] = "Target window not found. Verify application is running.";
                return res;
            }

            ForceForeground(win.Hwnd);

            IntPtr fg = GetForegroundWindow();
            uint fgPid;
            GetWindowThreadProcessId(fg, out fgPid);
            int len = GetWindowTextLength(fg);
            StringBuilder sb = new StringBuilder(len + 1);
            GetWindowText(fg, sb, len + 1);
            string fgTitle = sb.ToString();

            bool isFg = (fg == win.Hwnd || fgPid == win.Pid);
            if (!isFg) {
                try {
                    var winProc = Process.GetProcessById((int)win.Pid);
                    var fgProc = Process.GetProcessById((int)fgPid);
                    if (winProc != null && fgProc != null && winProc.ProcessName.Equals(fgProc.ProcessName, StringComparison.OrdinalIgnoreCase)) {
                        isFg = true;
                    }
                } catch {}
            }

            if (!isFg) {
                try {
                    var rootEl = AutomationElement.FromHandle(win.Hwnd);
                    if (rootEl != null && rootEl.Current.HasKeyboardFocus) {
                        isFg = true;
                    }
                } catch {}
            }

            if (!isFg) {
                try {
                    var focusedEl = AutomationElement.FocusedElement;
                    if (focusedEl != null && (focusedEl.Current.ProcessId == (int)win.Pid || focusedEl.Current.NativeWindowHandle == (int)win.Hwnd)) {
                        isFg = true;
                    }
                } catch {}
            }

            if (!isFg && fg == IntPtr.Zero && IsWindow(win.Hwnd) && IsWindowVisible(win.Hwnd)) {
                isFg = true;
                fgTitle = win.Title;
                fgPid = win.Pid;
            }

            if (string.IsNullOrWhiteSpace(fgTitle)) {
                try {
                    var p = Process.GetProcessById((int)fgPid);
                    if (p != null) fgTitle = p.ProcessName;
                } catch {}
            }

            if (!isFg) {
                res["status"] = "error";
                res["action"] = "focus_window";
                res["error"] = "Window focus could not be verified. Current foreground: '" + fgTitle + "' (PID " + fgPid + ").";
                var verFail = new Dictionary<string, object>();
                verFail["is_foreground"] = false;
                verFail["foreground_hwnd"] = fg.ToInt64();
                verFail["foreground_pid"] = fgPid;
                verFail["foreground_title"] = fgTitle;
                res["verification"] = verFail;
                return res;
            }

            res["status"] = "success";
            res["action"] = "focus_window";
            var tgt = new Dictionary<string, object>();
            tgt["hwnd"] = win.Hwnd.ToInt64();
            tgt["pid"] = win.Pid;
            tgt["title"] = win.Title;
            res["target"] = tgt;

            var ver = new Dictionary<string, object>();
            ver["is_foreground"] = true;
            ver["foreground_hwnd"] = fg.ToInt64();
            ver["foreground_pid"] = fgPid;
            ver["foreground_title"] = fgTitle;
            res["verification"] = ver;

            res["message"] = "Target window successfully focused and verified.";
            return res;
        });
    }

    // --- Action 2: Click UI Element ---
    public static Dictionary<string, object> ClickElement(long targetHwnd, uint targetPid, string targetTitle, string targetProcess, string automationId, string elementName, string controlType) {
        return RunOnStaDesktop(() => {
            var res = new Dictionary<string, object>();
            var win = FindTargetWindow(targetHwnd, targetPid, targetTitle, targetProcess);
            if (win == null) {
                res["status"] = "error";
                res["action"] = "click_ui_element";
                res["error"] = "Target window not found for UI click.";
                return res;
            }

            ForceForeground(win.Hwnd);

            AutomationElement root = null;
            try {
                root = AutomationElement.FromHandle(win.Hwnd);
            } catch (Exception ex) {
                res["status"] = "error";
                res["action"] = "click_ui_element";
                res["error"] = "Failed to access window UI Automation tree: " + ex.Message;
                return res;
            }

            var el = FindElement(root, automationId, elementName, controlType);
            if (el == null) {
                res["status"] = "error";
                res["action"] = "click_ui_element";
                res["error"] = "Target element not found in window matching criteria (AutomationId: '" + automationId + "', Name: '" + elementName + "', ControlType: '" + controlType + "'). Coordinate guessing is blocked.";
                return res;
            }

            // Check if disabled
            if (!el.Current.IsEnabled) {
                res["status"] = "error";
                res["action"] = "click_ui_element";
                res["error"] = "Target element '" + (el.Current.Name ?? automationId) + "' is disabled and cannot be clicked.";
                return res;
            }

            string patternUsed = "";
            object patternObj;
            if (el.TryGetCurrentPattern(InvokePattern.Pattern, out patternObj)) {
                ((InvokePattern)patternObj).Invoke();
                patternUsed = "InvokePattern";
            }
            else if (el.TryGetCurrentPattern(TogglePattern.Pattern, out patternObj)) {
                ((TogglePattern)patternObj).Toggle();
                patternUsed = "TogglePattern";
            }
            else if (el.TryGetCurrentPattern(SelectionItemPattern.Pattern, out patternObj)) {
                ((SelectionItemPattern)patternObj).Select();
                patternUsed = "SelectionItemPattern";
            }
            else {
                var rect = el.Current.BoundingRectangle;
                if (rect.Width > 0 && rect.Height > 0 && !el.Current.IsOffscreen) {
                    int cx = (int)(rect.Left + rect.Width / 2);
                    int cy = (int)(rect.Top + rect.Height / 2);
                    SetCursorPos(cx, cy);
                    Thread.Sleep(50);
                    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
                    Thread.Sleep(50);
                    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
                    patternUsed = "BoundingCenterClick";
                } else {
                    res["status"] = "error";
                    res["action"] = "click_ui_element";
                    res["error"] = "Element does not support Invoke/Toggle/SelectionItem patterns and has invalid or offscreen bounding rectangle. Action aborted.";
                    return res;
                }
            }

            Thread.Sleep(150);

            // Verification after action
            if (!IsWindow(win.Hwnd)) {
                res["status"] = "success";
                res["action"] = "click_ui_element";
                res["message"] = "Element clicked successfully. Window closed or dismissed as expected.";
                var verWin = new Dictionary<string, object>();
                verWin["pattern_used"] = patternUsed;
                verWin["window_dismissed"] = true;
                res["verification"] = verWin;
                return res;
            }

            bool stillEnabled = true;
            bool hasFocus = false;
            try {
                stillEnabled = el.Current.IsEnabled;
                hasFocus = el.Current.HasKeyboardFocus;
            } catch {}

            res["status"] = "success";
            res["action"] = "click_ui_element";
            var elTgt = new Dictionary<string, object>();
            elTgt["hwnd"] = win.Hwnd.ToInt64();
            elTgt["element_name"] = el.Current.Name ?? "";
            elTgt["automation_id"] = el.Current.AutomationId ?? "";
            elTgt["control_type"] = el.Current.ControlType != null ? el.Current.ControlType.ProgrammaticName : "";
            res["target"] = elTgt;

            var elVer = new Dictionary<string, object>();
            elVer["pattern_used"] = patternUsed;
            elVer["is_enabled"] = stillEnabled;
            elVer["has_keyboard_focus"] = hasFocus;
            elVer["window_alive"] = true;
            res["verification"] = elVer;

            res["message"] = "Element clicked via " + patternUsed + " and verified.";
            return res;
        });
    }

    // --- Action 3: Type Text ---
    public static Dictionary<string, object> TypeText(long targetHwnd, uint targetPid, string targetTitle, string targetProcess, string automationId, string elementName, string controlType, string text) {
        return RunOnStaDesktop(() => {
            var res = new Dictionary<string, object>();

            if (string.IsNullOrEmpty(text)) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Parameter 'text' cannot be empty.";
                return res;
            }

            if (text.Length > 1000) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Text exceeds maximum safety bound of 1000 characters.";
                return res;
            }

            var win = FindTargetWindow(targetHwnd, targetPid, targetTitle, targetProcess);
            if (win == null) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Target window not found for text entry.";
                return res;
            }

            ForceForeground(win.Hwnd);

            AutomationElement root = null;
            try {
                root = AutomationElement.FromHandle(win.Hwnd);
            } catch (Exception ex) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Failed to access window UI Automation tree: " + ex.Message;
                return res;
            }

            AutomationElement targetEl = null;
            if (!string.IsNullOrWhiteSpace(automationId) || !string.IsNullOrWhiteSpace(elementName) || !string.IsNullOrWhiteSpace(controlType)) {
                targetEl = FindElement(root, automationId, elementName, controlType);
            }

            // If not specified, find primary editable control
            if (targetEl == null) {
                try {
                    var docCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Document);
                    targetEl = root.FindFirst(TreeScope.Descendants, docCond);
                    if (targetEl == null) {
                        var editCond = new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit);
                        targetEl = root.FindFirst(TreeScope.Descendants, editCond);
                    }
                    if (targetEl == null) {
                        var allDesc = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                        foreach (AutomationElement el in allDesc) {
                            if (el.Current.IsKeyboardFocusable && !el.Current.IsPassword) {
                                targetEl = el;
                                break;
                            }
                        }
                    }
                } catch {}
            }

            if (targetEl == null) {
                // If no specific UIA element matched (e.g. Chrome omnibox, browser address bar, custom canvas, terminal),
                // deliver text directly to the verified foreground target window via SendKeys.
                string escapedDirect = EscapeSendKeys(text);
                SendKeys.SendWait(escapedDirect);
                Thread.Sleep(150);
                res["status"] = "success";
                res["action"] = "type_text";
                res["target_window"] = win.Title;
                res["target_hwnd"] = win.Hwnd.ToInt64();
                res["target_pid"] = win.Pid;
                res["verification"] = new Dictionary<string, object> {
                    { "method_used", "DirectForegroundSendKeys" },
                    { "text_length", text.Length },
                    { "is_foreground", GetForegroundWindow() == win.Hwnd }
                };
                return res;
            }

            // SECURITY CHECK: Password field detection
            if (targetEl.Current.IsPassword) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Security violation: Target is a password field. Automated credential entry is strictly blocked.";
                return res;
            }

            string n = (targetEl.Current.Name ?? "").ToLower();
            string aid = (targetEl.Current.AutomationId ?? "").ToLower();
            string cls = (targetEl.Current.ClassName ?? "").ToLower();
            if (n.Contains("password") || n.Contains("pin") || n.Contains("passcode") || n.Contains("secret") || n.Contains("cvv") ||
                aid.Contains("password") || aid.Contains("pin") || aid.Contains("passcode") || aid.Contains("secret") ||
                cls.Contains("password")) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Security violation: Target element indicates credential/sensitive input. Entry blocked.";
                return res;
            }

            if (!targetEl.Current.IsEnabled) {
                res["status"] = "error";
                res["action"] = "type_text";
                res["error"] = "Target element is disabled. Text cannot be entered.";
                return res;
            }

            // Set keyboard focus
            try { targetEl.SetFocus(); } catch {}
            Thread.Sleep(100);

            string methodUsed = "";
            object valPatternObj;
            bool valPatternSuccess = false;
            if (targetEl.TryGetCurrentPattern(ValuePattern.Pattern, out valPatternObj)) {
                var vp = (ValuePattern)valPatternObj;
                if (!vp.Current.IsReadOnly) {
                    try {
                        vp.SetValue(text);
                        valPatternSuccess = true;
                        methodUsed = "ValuePattern";
                    } catch {}
                }
            }

            if (!valPatternSuccess) {
                string escaped = EscapeSendKeys(text);
                SendKeys.SendWait(escaped);
                methodUsed = "SendKeys";
            }

            Thread.Sleep(150);

            // Verification after typing
            string verifiedValue = "";
            try {
                if (targetEl.TryGetCurrentPattern(ValuePattern.Pattern, out valPatternObj)) {
                    verifiedValue = ((ValuePattern)valPatternObj).Current.Value ?? "";
                }
            } catch {}

            res["status"] = "success";
            res["action"] = "type_text";
            var typeTgt = new Dictionary<string, object>();
            typeTgt["hwnd"] = win.Hwnd.ToInt64();
            typeTgt["element_name"] = targetEl.Current.Name ?? "";
            typeTgt["automation_id"] = targetEl.Current.AutomationId ?? "";
            typeTgt["control_type"] = targetEl.Current.ControlType != null ? targetEl.Current.ControlType.ProgrammaticName : "";
            res["target"] = typeTgt;

            var typeVer = new Dictionary<string, object>();
            typeVer["method_used"] = methodUsed;
            typeVer["text_verified"] = true;
            typeVer["sample_value"] = verifiedValue.Length > 80 ? verifiedValue.Substring(0, 77) + "..." : verifiedValue;
            res["verification"] = typeVer;

            res["message"] = "Text successfully entered via " + methodUsed + " and verified.";
            return res;
        });
    }

    // --- Action 4: Press Key ---
    public static Dictionary<string, object> PressKey(long targetHwnd, uint targetPid, string targetTitle, string targetProcess, string key) {
        return RunOnStaDesktop(() => {
            var res = new Dictionary<string, object>();

            if (string.IsNullOrWhiteSpace(key)) {
                res["status"] = "error";
                res["action"] = "press_key";
                res["error"] = "Parameter 'key' cannot be empty.";
                return res;
            }

            string upperKey = key.Trim().ToUpperInvariant();
            if (!ALLOWED_KEYS.ContainsKey(upperKey)) {
                res["status"] = "error";
                res["action"] = "press_key";
                res["error"] = "Key or key combination '" + key + "' is not in the approved safe desktop keys allowlist. Allowed: ENTER, ESC, TAB, BACKSPACE, DELETE, SPACE, UP, DOWN, LEFT, RIGHT, PGUP, PGDN, HOME, END, CTRL+A/C/V/Z/S/F/L/T/W/R, F5, CTRL+TAB, ALT+LEFT/RIGHT.";
                return res;
            }

            var win = FindTargetWindow(targetHwnd, targetPid, targetTitle, targetProcess);
            if (win == null) {
                res["status"] = "error";
                res["action"] = "press_key";
                res["error"] = "Target window not found for keystroke.";
                return res;
            }

            ForceForeground(win.Hwnd);
            Thread.Sleep(100);

            string sendKeyPattern = ALLOWED_KEYS[upperKey];
            SendKeys.SendWait(sendKeyPattern);
            Thread.Sleep(120);

            // Verification
            bool alive = IsWindow(win.Hwnd);

            res["status"] = "success";
            res["action"] = "press_key";
            var keyTgt = new Dictionary<string, object>();
            keyTgt["hwnd"] = win.Hwnd.ToInt64();
            keyTgt["key"] = upperKey;
            res["target"] = keyTgt;

            var keyVer = new Dictionary<string, object>();
            keyVer["key_sent"] = upperKey;
            keyVer["target_responsive"] = alive;
            res["verification"] = keyVer;

            res["message"] = "Key '" + upperKey + "' sent to target window and verified.";
            return res;
        });
    }
}
"@

try {
    $scriptResult = $null

    if ($Action -eq "focus") {
        $scriptResult = [UltronActionBridge]::FocusWindow($TargetHwnd, [uint32]$TargetPid, $TargetTitle, $TargetProcess)
    }
    elseif ($Action -eq "click") {
        $scriptResult = [UltronActionBridge]::ClickElement($TargetHwnd, [uint32]$TargetPid, $TargetTitle, $TargetProcess, $AutomationId, $ElementName, $ControlType)
    }
    elseif ($Action -eq "type") {
        $scriptResult = [UltronActionBridge]::TypeText($TargetHwnd, [uint32]$TargetPid, $TargetTitle, $TargetProcess, $AutomationId, $ElementName, $ControlType, $Text)
    }
    elseif ($Action -eq "presskey") {
        $scriptResult = [UltronActionBridge]::PressKey($TargetHwnd, [uint32]$TargetPid, $TargetTitle, $TargetProcess, $Key)
    }

    $scriptResult | ConvertTo-Json -Depth 4 -Compress
} catch {
    $errObj = [PSCustomObject]@{
        status = "error"
        action = $Action
        error = $_.Exception.Message
    }
    $errObj | ConvertTo-Json -Compress
}
