@echo off
rem Dayflow launcher. --no-sandbox is required on some locked-down Windows
rem environments where Chromium cannot create its sandbox token.
setlocal
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_NO_ATTACH_CONSOLE="
pushd "%~dp0"
set "APP=%CD%"
start "" "%~dp0node_modules\electron\dist\electron.exe" "%APP%" --user-data-dir="%APP%\data" --no-sandbox
popd