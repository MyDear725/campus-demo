@echo off
chcp 65001 >nul
set "CAMPUS_BLENDER=%~dp0..\..\..\.tools\blender-4.5.9-windows-x64\blender.exe"
if not exist "%CAMPUS_BLENDER%" (
  echo 未找到便携版 Blender，请用 Blender 打开同目录的 campus-traveler.blend。
  pause
  exit /b 1
)
start "" "%CAMPUS_BLENDER%" "%~dp0campus-traveler.blend"
