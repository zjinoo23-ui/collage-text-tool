@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   未检测到 Node.js，无法自动生成局域网地址与二维码。
  echo   可先安装 Node.js（https://nodejs.org），或临时用 Python 启动：
  echo       python -m http.server 8000 --bind 0.0.0.0
  echo   然后用 ipconfig 查看本机 IPv4，在手机浏览器访问 http://^<本机IP^>:8000
  echo.
  pause
  exit /b 1
)

node serve.mjs
pause
