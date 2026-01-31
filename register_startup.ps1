$WshShell = New-Object -ComObject WScript.Shell
$StartupPath = [Environment]::GetFolderPath('Startup')
$Shortcut = $WshShell.CreateShortcut("$StartupPath\weather.lnk")
$Shortcut.TargetPath = "C:\hjkim\weather.bat"
$Shortcut.WorkingDirectory = "C:\hjkim"
$Shortcut.Save()
Write-Host "등록 완료!"
