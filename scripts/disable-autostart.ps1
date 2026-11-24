# Dayflow - disable autostart
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
Remove-ItemProperty -Path $key -Name 'Dayflow' -ErrorAction SilentlyContinue
Write-Host 'Autostart disabled.'