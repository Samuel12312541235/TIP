; 日序 Dayflow — Windows installer (NSIS)
; Build with: npm run installer

Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

!ifndef APP_VERSION
  !define APP_VERSION "1.0.0"
!endif
!ifndef APP_DIR
  !define APP_DIR "..\release\win-unpacked"
!endif
!ifndef OUT_FILE
  !define OUT_FILE "..\release\Dayflow-1.0.0-Setup.exe"
!endif
!ifndef ICON_FILE
  !define ICON_FILE "..\assets\icon.ico"
!endif

Name "日序 Dayflow"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Dayflow"
InstallDirRegKey HKCU "Software\Dayflow" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
XPStyle on
ManifestDPIAware true
BrandingText "日序 Dayflow · 本地优先"

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "日序 Dayflow"
VIAddVersionKey "FileDescription" "日序 · 本地优先的个人日程中枢"
VIAddVersionKey "FileVersion" "1.0.0.0"
VIAddVersionKey "ProductVersion" "1.0.0"
VIAddVersionKey "CompanyName" "Samuel"
VIAddVersionKey "LegalCopyright" "Copyright © 2026 Samuel"

Icon "${ICON_FILE}"
UninstallIcon "${ICON_FILE}"

!define MUI_ABORTWARNING
!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_WELCOMEPAGE_TITLE "欢迎安装日序 Dayflow"
!define MUI_WELCOMEPAGE_TEXT "日序是一款本地优先的日程应用。$\r$\n$\r$\n安装会放到当前用户目录，不需要管理员权限。日程数据保存在 %APPDATA%\Dayflow，卸载时不会自动删除。"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Dayflow.exe"
!define MUI_FINISHPAGE_RUN_TEXT "运行日序 Dayflow"
!define MUI_FINISHPAGE_LINK "查看使用说明"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/Samuel12312541235/TIP#readme"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\Dayflow" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Dayflow" "Version" "${APP_VERSION}"

  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "DisplayName" "日序 Dayflow"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "Publisher" "Samuel"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "DisplayIcon" "$INSTDIR\Dayflow.exe,0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "QuietUninstallString" "$\"$INSTDIR\Uninstall.exe$\" /S"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "URLInfoAbout" "https://github.com/Samuel12312541235/TIP"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow" "EstimatedSize" 250000

  CreateShortCut "$DESKTOP\日序 Dayflow.lnk" "$INSTDIR\Dayflow.exe" "" "$INSTDIR\Dayflow.exe" 0
  CreateDirectory "$SMPROGRAMS\日序 Dayflow"
  CreateShortCut "$SMPROGRAMS\日序 Dayflow\日序 Dayflow.lnk" "$INSTDIR\Dayflow.exe" "" "$INSTDIR\Dayflow.exe" 0
  CreateShortCut "$SMPROGRAMS\日序 Dayflow\卸载 日序 Dayflow.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\日序 Dayflow.lnk"
  Delete "$SMPROGRAMS\日序 Dayflow\日序 Dayflow.lnk"
  Delete "$SMPROGRAMS\日序 Dayflow\卸载 日序 Dayflow.lnk"
  RMDir "$SMPROGRAMS\日序 Dayflow"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Dayflow"
  DeleteRegKey HKCU "Software\Dayflow"

  IfSilent skipDataPrompt
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除本机日程数据？$\r$\n$\r$\n选择“否”会保留 %APPDATA%\Dayflow，方便以后重装继续使用。" IDNO +2
  RMDir /r "$APPDATA\Dayflow"
  skipDataPrompt:

  RMDir /r "$INSTDIR"
SectionEnd
