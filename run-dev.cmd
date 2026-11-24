@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
pushd "%~dp0"
set "APP=%CD%"
"%~dp0node_modules\electron\dist\electron.exe" "%APP%" --user-data-dir="%APP%\data" --no-sandbox --remote-debugging-port=9222 > "%~dp0dev.log" 2>&1
popd