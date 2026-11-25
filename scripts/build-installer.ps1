$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $root 'release\win-unpacked'
$icon = Join-Path $root 'assets\icon.ico'
$nsi = Join-Path $root 'build\installer.nsi'
$packageText = [System.IO.File]::ReadAllText((Join-Path $root 'package.json'), [System.Text.Encoding]::UTF8)
$versionMatch = [regex]::Match($packageText, '"version"\s*:\s*"([^"]+)"')
if (-not $versionMatch.Success) { throw '无法读取 package.json 版本号。' }
$version = $versionMatch.Groups[1].Value
$outFile = Join-Path $root "release\Dayflow-$version-Setup.exe"

if (-not (Test-Path (Join-Path $appDir 'Dayflow.exe'))) {
  throw "未找到 release\win-unpacked\Dayflow.exe，请先运行 npm run dist。"
}

$candidates = @()
$cmd = Get-Command makensis -ErrorAction SilentlyContinue
if ($cmd) { $candidates += $cmd.Source }
$cache = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache'
if (Test-Path $cache) {
  $candidates += Get-ChildItem $cache -Recurse -Filter makensis.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\Bin\\makensis\.exe$' } |
    Select-Object -ExpandProperty FullName
}
$candidates += @(
  'C:\Program Files (x86)\NSIS\makensis.exe',
  'C:\Program Files\NSIS\makensis.exe'
)
$makensis = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $makensis) {
  throw '未找到 makensis.exe。请安装 NSIS，或先让 electron-builder 下载 NSIS。'
}

Write-Host "makensis = $makensis"
Write-Host "app      = $appDir"
Write-Host "output   = $outFile"

& $makensis /V2 /INPUTCHARSET UTF8 "/DAPP_DIR=$appDir" "/DOUT_FILE=$outFile" "/DICON_FILE=$icon" "/DAPP_VERSION=$version" $nsi
if ($LASTEXITCODE -ne 0) { throw "NSIS 编译失败，exit code $LASTEXITCODE" }

$file = Get-Item $outFile
if ($file.Length -lt 50MB) {
  throw "安装包大小异常：$($file.Length) bytes。"
}
Write-Host ("OK  {0}  {1:N1} MB" -f $file.FullName, ($file.Length / 1MB))
