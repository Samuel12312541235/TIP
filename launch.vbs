' Dayflow silent launcher
Option Explicit
Dim sh, fso, base, cmdPath
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = base & "\start-dayflow.cmd"
If Not fso.FileExists(cmdPath) Then
  MsgBox "Launcher not found: " & cmdPath, 16, "Dayflow"
  WScript.Quit 1
End If
sh.CurrentDirectory = base
sh.Run """" & cmdPath & """", 0, False