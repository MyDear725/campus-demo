@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js，再运行此文件。
  pause
  exit /b 1
)
if not exist "node_modules\three\build\three.module.js" (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
node launch.mjs
if errorlevel 1 pause
