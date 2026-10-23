# Windows UI Automation Read-Only Bridge for ULTRON (Phase 3A)
# Strict Read-Only: Only reads window information and accessibility tree properties.
# No mouse clicks, typing, or state mutations.

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("enumerate", "inspect")]
    [string]$Action,

    [int]$TargetPid = 0,
    [string]$TargetTitle = "",
    [string]$TargetProcess = "",
    [long]$TargetHwnd = 0,
    [string]$Filter = "",
    [int]$MaxDepth = 3,
    [int]$MaxElements = 60
)

# Enforce bounds
if ($MaxDepth -lt 1) { $MaxDepth = 1 }
if ($MaxDepth -gt 6) { $MaxDepth = 6 }
if ($MaxElements -lt 1) { $MaxElements = 1 }
if ($MaxElements -gt 100) { $MaxElements = 100 }

Add-Type -ReferencedAssemblies UIAutomationClient, UIAutomationTypes, WindowsBase -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

public class UltronUiaBridge {
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
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

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

    public class WindowSummary {
        public long Hwnd { get; set; }
        public uint Pid { get; set; }
        public string Title { get; set; }
        public string ClassName { get; set; }
        public bool IsVisible { get; set; }
        public bool IsMinimized { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
    }

    public class ElementInfo {
        public string Name { get; set; }
        public string AutomationId { get; set; }
        public string ControlType { get; set; }
        public string ClassName { get; set; }
        public bool IsEnabled { get; set; }
        public bool HasKeyboardFocus { get; set; }
        public bool IsOffscreen { get; set; }
        public int X { get; set; }
        public int Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public int Depth { get; set; }
    }

    public static List<WindowSummary> EnumerateWindows() {
        var results = new List<WindowSummary>();
        var seenHwnds = new HashSet<long>();

        try {
            IntPtr hWinsta = OpenWindowStation("WinSta0", false, 0x037F);
            if (hWinsta != IntPtr.Zero) {
                SetProcessWindowStation(hWinsta);
            }
        } catch {}

        IntPtr hDesktop = OpenDesktop("Default", 0, false, DESKTOP_ALL_ACCESS);
        if (hDesktop == IntPtr.Zero) {
            hDesktop = OpenDesktop("Default", 0, false, 0x01FF);
        }
        if (hDesktop == IntPtr.Zero) {
            hDesktop = OpenDesktop("Default", 0, false, 0x0041);
        }

        EnumWindowsProc proc = (hWnd, lParam) => {
            try {
                long hVal = hWnd.ToInt64();
                if (seenHwnds.Contains(hVal)) return true;

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

                // Include windows with titles or meaningful visible UI
                if (!string.IsNullOrWhiteSpace(title) && (visible || (w > 50 && h > 50)) && w > 0 && h > 0) {
                    seenHwnds.Add(hVal);
                    results.Add(new WindowSummary {
                        Hwnd = hVal,
                        Pid = pid,
                        Title = title,
                        ClassName = cls,
                        IsVisible = visible,
                        IsMinimized = IsIconic(hWnd),
                        X = rect.Left,
                        Y = rect.Top,
                        Width = w,
                        Height = h
                    });
                }
            } catch {}
            return true;
        };

        if (hDesktop != IntPtr.Zero) {
            try { SetThreadDesktop(hDesktop); } catch {}
            EnumDesktopWindows(hDesktop, proc, IntPtr.Zero);
            CloseDesktop(hDesktop);
        }

        // Also call EnumWindows to ensure full desktop coverage
        try {
            EnumWindows(proc, IntPtr.Zero);
        } catch {}

        return results;
    }

    public static List<ElementInfo> InspectWindowTree(long hwnd, uint targetPid, string targetTitle, string targetProcess, int maxDepth, int maxElements) {
        var elements = new List<ElementInfo>();

        // If HWND is not provided, try resolving HWND from top-level window list
        if (hwnd <= 0) {
            var windows = EnumerateWindows();
            foreach (var w in windows) {
                if (targetPid > 0 && w.Pid == targetPid) {
                    hwnd = w.Hwnd;
                    break;
                }
                if (!string.IsNullOrWhiteSpace(targetTitle) && 
                    w.Title.IndexOf(targetTitle, StringComparison.OrdinalIgnoreCase) >= 0) {
                    hwnd = w.Hwnd;
                    break;
                }
                if (!string.IsNullOrWhiteSpace(targetProcess)) {
                    try {
                        var p = System.Diagnostics.Process.GetProcessById((int)w.Pid);
                        if (p != null && p.ProcessName.IndexOf(targetProcess, StringComparison.OrdinalIgnoreCase) >= 0) {
                            hwnd = w.Hwnd;
                            break;
                        }
                    } catch {}
                }
            }
        }

        IntPtr hDesktop = OpenDesktop("Default", 0, false, DESKTOP_ALL_ACCESS);
        if (hDesktop == IntPtr.Zero) {
            hDesktop = OpenDesktop("Default", 0, false, 0x0041);
        }

        Exception caughtEx = null;
        Thread worker = new Thread(() => {
            try {
                if (hDesktop != IntPtr.Zero) {
                    SetThreadDesktop(hDesktop);
                }

                AutomationElement targetEl = null;

                if (hwnd > 0) {
                    try {
                        targetEl = AutomationElement.FromHandle(new IntPtr(hwnd));
                    } catch {}
                }

                if (targetEl == null && targetPid > 0) {
                    try {
                        var root = AutomationElement.RootElement;
                        var cond = new PropertyCondition(AutomationElement.ProcessIdProperty, (int)targetPid);
                        targetEl = root.FindFirst(TreeScope.Children, cond);
                        if (targetEl == null) {
                            targetEl = root.FindFirst(TreeScope.Descendants, cond);
                        }
                    } catch {}
                }

                if (targetEl == null && !string.IsNullOrWhiteSpace(targetTitle)) {
                    try {
                        var root = AutomationElement.RootElement;
                        var all = root.FindAll(TreeScope.Children, Condition.TrueCondition);
                        foreach (AutomationElement c in all) {
                            if (c.Current.Name != null && c.Current.Name.IndexOf(targetTitle, StringComparison.OrdinalIgnoreCase) >= 0) {
                                targetEl = c;
                                break;
                            }
                        }
                    } catch {}
                }

                if (targetEl == null) {
                    return;
                }

                // Collect target root element itself
                AddElement(targetEl, 0, elements);

                // Traverse descendants breadth/depth-bounded
                Traverse(targetEl, 1, maxDepth, maxElements, elements);
            } catch (Exception ex) {
                caughtEx = ex;
            }
        });

        worker.SetApartmentState(ApartmentState.STA);
        worker.Start();
        worker.Join(8000); // 8 second hard worker join timeout

        if (hDesktop != IntPtr.Zero) {
            CloseDesktop(hDesktop);
        }

        if (caughtEx != null) {
            throw caughtEx;
        }

        return elements;
    }

    private static void Traverse(AutomationElement parent, int currentDepth, int maxDepth, int maxElements, List<ElementInfo> elements) {
        if (currentDepth > maxDepth || elements.Count >= maxElements) return;

        try {
            var children = parent.FindAll(TreeScope.Children, Condition.TrueCondition);
            foreach (AutomationElement child in children) {
                if (elements.Count >= maxElements) break;
                AddElement(child, currentDepth, elements);
                Traverse(child, currentDepth + 1, maxDepth, maxElements, elements);
            }
        } catch {}
    }

    private static void AddElement(AutomationElement el, int depth, List<ElementInfo> elements) {
        try {
            var cur = el.Current;
            var r = cur.BoundingRectangle;
            var info = new ElementInfo {
                Name = cur.Name ?? "",
                AutomationId = cur.AutomationId ?? "",
                ControlType = cur.ControlType != null ? cur.ControlType.ProgrammaticName : "Unknown",
                ClassName = cur.ClassName ?? "",
                IsEnabled = cur.IsEnabled,
                HasKeyboardFocus = cur.HasKeyboardFocus,
                IsOffscreen = cur.IsOffscreen,
                X = (int)r.X,
                Y = (int)r.Y,
                Width = (int)r.Width,
                Height = (int)r.Height,
                Depth = depth
            };
            // Truncate overly long names for safety
            if (info.Name.Length > 120) {
                info.Name = info.Name.Substring(0, 117) + "...";
            }
            elements.Add(info);
        } catch {}
    }
}
"@

try {
    if ($Action -eq "enumerate") {
        $windows = [UltronUiaBridge]::EnumerateWindows()
        
        # Apply filter if provided
        if (-not [string]::IsNullOrWhiteSpace($Filter)) {
            $f = $Filter.ToLower()
            $windows = $windows | Where-Object { 
                $_.Title.ToLower().Contains($f) -or $_.ClassName.ToLower().Contains($f)
            }
        }

        # Resolve process names safely
        $formatted = @()
        foreach ($w in $windows) {
            $procName = ""
            try {
                $p = Get-Process -Id $w.Pid -ErrorAction SilentlyContinue
                if ($p) { $procName = $p.ProcessName }
            } catch {}

            $formatted += [PSCustomObject]@{
                hwnd = $w.Hwnd
                pid = $w.Pid
                process_name = $procName
                title = $w.Title
                class_name = $w.ClassName
                is_visible = $w.IsVisible
                is_minimized = $w.IsMinimized
                bounds = [PSCustomObject]@{
                    x = $w.X
                    y = $w.Y
                    width = $w.Width
                    height = $w.Height
                }
            }
            if ($formatted.Count -ge 50) { break }
        }

        $result = [PSCustomObject]@{
            status = "success"
            count = $formatted.Count
            windows = $formatted
        }
        $result | ConvertTo-Json -Depth 4 -Compress
    }
    elseif ($Action -eq "inspect") {
        $elements = [UltronUiaBridge]::InspectWindowTree($TargetHwnd, [uint32]$TargetPid, $TargetTitle, $TargetProcess, $MaxDepth, $MaxElements)
        
        if ($elements.Count -eq 0) {
            $result = [PSCustomObject]@{
                status = "error"
                error = "Target window not found or accessibility tree could not be reached."
                target = [PSCustomObject]@{
                    hwnd = $TargetHwnd
                    pid = $TargetPid
                    title = $TargetTitle
                    process = $TargetProcess
                }
            }
            $result | ConvertTo-Json -Depth 3 -Compress
            exit 0
        }

        $formattedElements = @()
        foreach ($e in $elements) {
            $formattedElements += [PSCustomObject]@{
                depth = $e.Depth
                name = $e.Name
                automation_id = $e.AutomationId
                control_type = $e.ControlType
                class_name = $e.ClassName
                is_enabled = $e.IsEnabled
                has_keyboard_focus = $e.HasKeyboardFocus
                is_offscreen = $e.IsOffscreen
                bounds = [PSCustomObject]@{
                    x = $e.X
                    y = $e.Y
                    width = $e.Width
                    height = $e.Height
                }
            }
        }

        $result = [PSCustomObject]@{
            status = "success"
            window_root = $formattedElements[0]
            element_count = $formattedElements.Count
            elements = $formattedElements
        }
        $result | ConvertTo-Json -Depth 4 -Compress
    }
} catch {
    $errObj = [PSCustomObject]@{
        status = "error"
        error = $_.Exception.Message
    }
    $errObj | ConvertTo-Json -Compress
}
