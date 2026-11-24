param([int]$Seconds = 8)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$rec = $null
try {
  Add-Type -AssemblyName System.Speech
  $rec = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  $rec.SetInputToDefaultAudioDevice()
  $dict = New-Object System.Speech.Recognition.DictationGrammar
  $rec.LoadGrammar($dict)
  $rec.InitialSilenceTimeout = [TimeSpan]::FromSeconds(6)
  $rec.BabbleTimeout = [TimeSpan]::FromSeconds(3)
  $rec.EndSilenceTimeout = [TimeSpan]::FromSeconds(1.2)
  $result = $rec.Recognize([TimeSpan]::FromSeconds($Seconds))
  if ($result) {
    [Console]::Out.Write($result.Text)
  }
} catch {
  [Console]::Error.Write($_.Exception.Message)
  exit 1
} finally {
  if ($rec) { $rec.Dispose() }
}
