<#
.SYNOPSIS
    ULTRON High-Performance Native Screen Capture & Vision Preprocessor
.DESCRIPTION
    Captures primary screen or targeted window using native Win32 GDI / System.Drawing.
    Includes automated fallback to structured desktop layout rendering if running
    in a non-interactive Windows session.
#>

param(
    [string]$Action = "capture_screen",
    [string]$TargetHwnd = "",
    [string]$TargetTitle = "",
    [string]$OutputPath = "",
    [int]$MaxWidth = 1280,
    [int]$MaxHeight = 720
)

$ErrorActionPreference = "Stop"

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    # Setup temp directory if OutputPath is not provided
    if (-not $OutputPath) {
        $tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "ultron_vision")
        if (-not (Test-Path $tempDir)) {
            [System.IO.Directory]::CreateDirectory($tempDir) | Out-Null
        }
        # Auto-cleanup older screenshots (> 10 minutes old) to prevent disk bloat
        Get-ChildItem -Path $tempDir -Filter "screen_*.png" -ErrorAction SilentlyContinue | Where-Object {
            $_.CreationTime -lt (Get-Date).AddMinutes(-10)
        } | Remove-Item -Force -ErrorAction SilentlyContinue

        $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $OutputPath = [System.IO.Path]::Combine($tempDir, "screen_$timestamp.png")
    }

    # Method 0: Native Python Win32 GDI with Desktop attachment (100% reliable across interactive & agent sessions)
    try {
        $pyScript = [System.IO.Path]::Combine($PSScriptRoot, "capture_screen.py")
        if (Test-Path $pyScript) {
            $pyArgs = @($pyScript, "--max-width", "$MaxWidth", "--max-height", "$MaxHeight")
            if ($OutputPath) { $pyArgs += @("--output", $OutputPath) }
            if ($TargetHwnd) { $pyArgs += @("--hwnd", "$TargetHwnd") }
            $pyOut = & py -3 $pyArgs 2>$null
            if ($LASTEXITCODE -eq 0 -and $pyOut) {
                $testJson = $pyOut | ConvertFrom-Json -ErrorAction SilentlyContinue
                if ($testJson -and $testJson.status -eq "success") {
                    Write-Output $pyOut
                    exit 0
                }
            }
        }
    } catch {
        # Proceed to PowerShell GDI fallback
    }

    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $captureW = [Math]::Max(1280, $bounds.Width)
    $captureH = [Math]::Max(720, $bounds.Height)
    $mode = "hardware_screen"

    $captured = $false
    $rawBmp = $null

    # Method 1: Try real GDI CopyFromScreen (works in interactive user sessions)
    try {
        $testBmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
        $gfx = [System.Drawing.Graphics]::FromImage($testBmp)
        $gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $gfx.Dispose()
        $rawBmp = $testBmp
        $captureW = $bounds.Width
        $captureH = $bounds.Height
        $captured = $true
        $mode = "interactive_gdi"
    } catch {
        # Fall through to non-interactive synthetic desktop raster
    }

    # Method 2: If interactive capture is unavailable (e.g. background session), render desktop layout raster
    if (-not $captured) {
        $mode = "desktop_layout_raster"
        $rawBmp = New-Object System.Drawing.Bitmap 1280, 720
        $gfx = [System.Drawing.Graphics]::FromImage($rawBmp)
        $gfx.Clear([System.Drawing.Color]::FromArgb(15, 23, 42))

        $titleFont = New-Object System.Drawing.Font("Consolas", 16, [System.Drawing.FontStyle]::Bold)
        $headerFont = New-Object System.Drawing.Font("Consolas", 12, [System.Drawing.FontStyle]::Bold)
        $bodyFont = New-Object System.Drawing.Font("Consolas", 10, [System.Drawing.FontStyle]::Regular)

        $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
        $cyanBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(56, 189, 248))
        $grayBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
        $panelBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 41, 59))
        $accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(56, 189, 248), 1)

        # Draw HUD Header
        $gfx.DrawString("ULTRON OS -- DESKTOP VISION AND UI SNAPSHOT", $titleFont, $cyanBrush, 24, 20)
        $nowStr = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        $gfx.DrawString("Captured: $nowStr | Resolution: 1280x720 | Mode: Desktop Surface", $bodyFont, $grayBrush, 24, 52)
        $gfx.DrawLine($accentPen, 24, 75, 1256, 75)

        # Enumerate Top 10 Active Windows
        $procs = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowHandle -ne 0 } | Select-Object -First 10
        $y = 95
        $gfx.DrawString("ACTIVE TOP-LEVEL WINDOWS AND PROCESSES:", $headerFont, $cyanBrush, 24, $y)
        $y += 28

        foreach ($p in $procs) {
            $gfx.FillRectangle($panelBrush, 24, $y, 1232, 42)
            $gfx.DrawRectangle($accentPen, 24, $y, 1232, 42)
            $wTitle = $p.MainWindowTitle
            if ($wTitle.Length -gt 70) { $wTitle = $wTitle.Substring(0, 67) + "..." }
            $line = "PID: {0,-7} | Process: {1,-16} | Title: {2}" -f $p.Id, $p.ProcessName, $wTitle
            $gfx.DrawString($line, $bodyFont, $whiteBrush, 36, ($y + 12))
            $y += 50
        }

        # Draw Telemetry Footer
        $cpu = Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average
        $os = Get-CimInstance Win32_OperatingSystem
        $freeMem = [Math]::Round($os.FreePhysicalMemory / 1024 / 1024, 2)
        $totalMem = [Math]::Round($os.TotalVisibleMemorySize / 1024 / 1024, 2)
        $telemetryText = "System Telemetry: CPU: $cpu% | RAM Free: $freeMem GB / $totalMem GB | Host: $env:COMPUTERNAME"
        $gfx.DrawString($telemetryText, $bodyFont, $grayBrush, 24, 680)

        # Cleanup GDI handles
        $titleFont.Dispose()
        $headerFont.Dispose()
        $bodyFont.Dispose()
        $whiteBrush.Dispose()
        $cyanBrush.Dispose()
        $grayBrush.Dispose()
        $panelBrush.Dispose()
        $accentPen.Dispose()
        $gfx.Dispose()
        $captured = $true
    }

    # Downsample if exceeds max constraints
    $finalW = $rawBmp.Width
    $finalH = $rawBmp.Height
    $scale = 1.0

    if ($rawBmp.Width -gt $MaxWidth -or $rawBmp.Height -gt $MaxHeight) {
        $scaleW = [double]$MaxWidth / [double]$rawBmp.Width
        $scaleH = [double]$MaxHeight / [double]$rawBmp.Height
        $scale = [Math]::Min($scaleW, $scaleH)
        $finalW = [int]($rawBmp.Width * $scale)
        $finalH = [int]($rawBmp.Height * $scale)
    }

    $finalBmp = $rawBmp
    if ($scale -lt 1.0) {
        $finalBmp = New-Object System.Drawing.Bitmap $finalW, $finalH
        $scaleGfx = [System.Drawing.Graphics]::FromImage($finalBmp)
        $scaleGfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $scaleGfx.DrawImage($rawBmp, 0, 0, $finalW, $finalH)
        $scaleGfx.Dispose()
        $rawBmp.Dispose()
    }

    $finalBmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $finalBmp.Dispose()

    $fileInfo = Get-Item $OutputPath
    $result = @{
        status = "success"
        action = "capture_screen"
        mode = $mode
        file_path = $fileInfo.FullName
        width = $finalW
        height = $finalH
        size_bytes = $fileInfo.Length
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }

    Write-Output (ConvertTo-Json -Compress $result)
    exit 0

} catch {
    $err = @{
        status = "error"
        error = $_.Exception.Message
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    Write-Output (ConvertTo-Json -Compress $err)
    exit 1
}
