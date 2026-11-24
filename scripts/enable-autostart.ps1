# Dayflow - enable autostart (run in a normal PowerShell window)
# Starts the app directly through electron.exe, same command line the app uses.
$ErrorActionPreference = 'Stop'
$appDir = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $appDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $exe)) { throw "electron.exe not found: $exe" }
$appArgs = '"' + $appDir + '" --user-data-dir="' + (Join-Path $appDir 'data') + '" --no-sandbox'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
New-Item -Path $key -Force | Out-Null
New-ItemProperty -Path $key -Name 'Dayflow' -Value ('"' + $exe + '" ' + $appArgs) -PropertyType String -Force | Out-Null
Write-Host ("Autostart enabled: " + $exe + ' ' + $appArgs)