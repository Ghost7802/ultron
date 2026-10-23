"""
ULTRON High-Performance Native Screen & Window Capture Engine
Captures real desktop displays or targeted windows via Win32 GDI & Desktop Window Manager.
Attaches to the active interactive desktop ('Default') to work reliably across processes.
"""

import sys
import os
import json
import time
import ctypes
from ctypes import wintypes
from PIL import Image

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32

SRCCOPY = 0x00CC0020
DESKTOP_ALL = 0x01FF

def capture_desktop(output_path=None, max_w=1280, max_h=720, target_hwnd=0):
    if not output_path:
        temp_dir = os.path.join(os.environ.get("TEMP", "C:\\Temp"), "ultron_vision")
        os.makedirs(temp_dir, exist_ok=True)
        # Clean up screenshots older than 10 mins
        now = time.time()
        for f in os.listdir(temp_dir):
            if f.startswith("screen_") and f.endswith(".png"):
                fp = os.path.join(temp_dir, f)
                try:
                    if now - os.path.getmtime(fp) > 600:
                        os.remove(fp)
                except Exception:
                    pass
        output_path = os.path.join(temp_dir, f"screen_{int(now * 1000)}.png")

    # Attach to active desktop
    hdesk = user32.OpenDesktopW("Default", 0, False, DESKTOP_ALL)
    if hdesk:
        user32.SetThreadDesktop(hdesk)

    target_title = ""
    is_target_window = False

    if target_hwnd and user32.IsWindow(target_hwnd):
        hwnd = target_hwnd
        is_target_window = True
        length = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        target_title = buf.value

        rect = wintypes.RECT()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))
        w = max(1, rect.right - rect.left)
        h = max(1, rect.bottom - rect.top)
        x, y = rect.left, rect.top
    else:
        hwnd = user32.GetDesktopWindow()
        w = user32.GetSystemMetrics(0) # SM_CXSCREEN
        h = user32.GetSystemMetrics(1) # SM_CYSCREEN
        x, y = 0, 0
        if w <= 0 or h <= 0:
            w, h = 1920, 1080

    hdc_src = user32.GetDC(0) # Capture DC of entire screen
    hdc_dest = gdi32.CreateCompatibleDC(hdc_src)
    hbmp = gdi32.CreateCompatibleBitmap(hdc_src, w, h)
    hold = gdi32.SelectObject(hdc_dest, hbmp)

    success = gdi32.BitBlt(hdc_dest, 0, 0, w, h, hdc_src, x, y, SRCCOPY)
    gdi32.SelectObject(hdc_dest, hold)

    if not success:
        gdi32.DeleteObject(hbmp)
        gdi32.DeleteDC(hdc_dest)
        user32.ReleaseDC(0, hdc_src)
        if hdesk:
            user32.CloseDesktop(hdesk)
        return {
            "status": "error",
            "error": "BitBlt failed to copy desktop surface",
            "timestamp": int(time.time() * 1000)
        }

    # Extract bitmap data to PIL Image
    class BITMAPINFOHEADER(ctypes.Structure):
        _fields_ = [
            ("biSize", wintypes.DWORD),
            ("biWidth", wintypes.LONG),
            ("biHeight", wintypes.LONG),
            ("biPlanes", wintypes.WORD),
            ("biBitCount", wintypes.WORD),
            ("biCompression", wintypes.DWORD),
            ("biSizeImage", wintypes.DWORD),
            ("biXPelsPerMeter", wintypes.LONG),
            ("biYPelsPerMeter", wintypes.LONG),
            ("biClrUsed", wintypes.DWORD),
            ("biClrImportant", wintypes.DWORD),
        ]

    bmi = BITMAPINFOHEADER()
    bmi.biSize = ctypes.sizeof(BITMAPINFOHEADER)
    bmi.biWidth = w
    bmi.biHeight = -h # top-down
    bmi.biPlanes = 1
    bmi.biBitCount = 32
    bmi.biCompression = 0 # BI_RGB

    buffer_size = w * h * 4
    buf = (ctypes.c_char * buffer_size)()
    gdi32.GetDIBits(hdc_dest, hbmp, 0, h, ctypes.byref(buf), ctypes.byref(bmi), 0)

    # Cleanup GDI handles immediately
    gdi32.DeleteObject(hbmp)
    gdi32.DeleteDC(hdc_dest)
    user32.ReleaseDC(0, hdc_src)
    if hdesk:
        user32.CloseDesktop(hdesk)

    img = Image.frombuffer("RGBA", (w, h), bytes(buf), "raw", "BGRA", 0, 1).convert("RGB")

    # Downsample if needed
    final_w, final_h = w, h
    if w > max_w or h > max_h:
        scale = min(float(max_w) / w, float(max_h) / h)
        final_w = int(w * scale)
        final_h = int(h * scale)
        img = img.resize((final_w, final_h), Image.Resampling.LANCZOS)

    img.save(output_path, "PNG")
    size_bytes = os.path.getsize(output_path)

    return {
        "status": "success",
        "action": "capture_screen",
        "mode": "real_desktop_gdi" if not is_target_window else "real_window_gdi",
        "file_path": os.path.abspath(output_path),
        "width": final_w,
        "height": final_h,
        "size_bytes": size_bytes,
        "target_hwnd": target_hwnd or None,
        "target_title": target_title or None,
        "timestamp": int(time.time() * 1000)
    }

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", "-o", default=None)
    parser.add_argument("--max-width", type=int, default=1280)
    parser.add_argument("--max-height", type=int, default=720)
    parser.add_argument("--hwnd", type=int, default=0)
    args = parser.parse_args()

    try:
        res = capture_desktop(
            output_path=args.output,
            max_w=args.max_width,
            max_h=args.max_height,
            target_hwnd=args.hwnd
        )
        print(json.dumps(res))
        sys.exit(0 if res.get("status") == "success" else 1)
    except Exception as e:
        err = {"status": "error", "error": str(e), "timestamp": int(time.time() * 1000)}
        print(json.dumps(err))
        sys.exit(1)

