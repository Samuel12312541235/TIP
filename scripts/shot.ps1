param(
  [string]$Out = "shot.png",
  [string]$TitleLike = "日序",
  [switch]$FullScreen
)
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DfWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("shcore.dll")] public static extern int SetProcessDpiAwareness(int value);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
try { [DfWin]::SetProcessDpiAwareness(2) | Out-Null } catch { [DfWin]::SetProcessDPIAware() | Out-Null }

$target = $null
if (-not $FullScreen) {
  $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and ($_.MainWindowTitle -like "*$TitleLike*" -or $_.ProcessName -like "*electron*") }
  if ($procs) { $target = ($procs | Sort-Object { $_.MainWindowTitle.Length } -Descending | Select-Object -First 1).MainWindowHandle }
  if (-not $target) {
    $procs = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 }
    foreach ($p in $procs) { Write-Output ("window: {0} | {1}" -f $p.ProcessName, $p.MainWindowTitle) }
  }
}

$bounds = New-Object System.Drawing.Rectangle
if ($target) {
  [DfWin]::ShowWindow($target, 9) | Out-Null
  [DfWin]::SetForegroundWindow($target) | Out-Null
  Start-Sleep -Milliseconds 450
  $r = New-Object DfWin+RECT
  [DfWin]::GetWindowRect($target, [ref]$r) | Out-Null
  $bounds = New-Object System.Drawing.Rectangle($r.Left, $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top))
} else {
  $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bounds = New-Object System.Drawing.Rectangle($b.X, $b.Y, $b.Width, $b.Height)
}
if ($bounds.Width -le 0 -or $bounds.Height -le 0) { throw "invalid capture bounds" }

$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output ("saved {0} {1}x{2} hwnd={3}" -f $Out, $bounds.Width, $bounds.Height, $target)
