@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo Starting server...

REM Kill any existing process on port 8090
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8090 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1

REM Start server using a temp PowerShell script (avoids execution policy issues)
echo $p = '%~dp0' > "%TEMP%\collage_server.ps1"
echo $p = $p.TrimEnd('\') >> "%TEMP%\collage_server.ps1"
echo $l = New-Object System.Net.HttpListener >> "%TEMP%\collage_server.ps1"
echo $l.Prefixes.Add('http://localhost:8090/') >> "%TEMP%\collage_server.ps1"
echo $l.Start() >> "%TEMP%\collage_server.ps1"
echo $mime = @{'.html'='text/html';'.js'='application/javascript';'.css'='text/css';'.png'='image/png';'.jpg'='image/jpeg';'.svg'='image/svg+xml'} >> "%TEMP%\collage_server.ps1"
echo while($l.IsListening){try{$c=$l.GetContext();$u=$c.Request.Url.LocalPath;if($u -eq '/'){$u='/index.html'};$f=Join-Path $p $u.TrimStart('/');if(Test-Path $f -PathType Leaf){$e=[IO.Path]::GetExtension($f);$t=$mime[$e];if(-not $t){$t='application/octet-stream'};$b=[IO.File]::ReadAllBytes($f);$c.Response.ContentType=$t;$c.Response.ContentLength64=$b.Length;$c.Response.OutputStream.Write($b,0,$b.Length)}else{$c.Response.StatusCode=404};$c.Response.Close()}catch{}} >> "%TEMP%\collage_server.ps1"

start "" powershell -ExecutionPolicy Bypass -NoProfile -File "%TEMP%\collage_server.ps1"

timeout /t 2 /nobreak >nul
start "" "http://localhost:8090/"

echo.
echo Done! Browser opened. Close this window to stop server.
pause
