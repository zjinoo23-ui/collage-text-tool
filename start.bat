@echo off
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   未检测到 Node.js，无法自动生成局域网地址和二维码。
  echo.
  echo   安装方法：打开 https://nodejs.org 下载 LTS 版，
  echo   一路下一步装完后，关闭本窗口，重新双击 start.bat。
  echo.
  echo   已有 Python 的话，也可以在本目录直接执行：
  echo       python -m http.server 8000 --bind 0.0.0.0
  echo   再用 ipconfig 查出本机 IPv4，
  echo   手机浏览器访问 http://本机IP:8000 即可
  echo.
  pause
  exit /b 1
)

node serve.mjs
pause
