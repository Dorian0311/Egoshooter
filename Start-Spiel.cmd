@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js installieren.
  pause
  exit /b 1
)
if not exist node_modules\tsx (
  echo Abhaengigkeiten fehlen. Bitte zuerst npm install ausfuehren.
  pause
  exit /b 1
)
echo Lokales Training startet. Dieses Fenster zum Spielen offen lassen.
echo Im Browser auf "Alleine testen" klicken.
echo Zum Beenden Strg+C druecken.
call npm run preview:solo
pause
