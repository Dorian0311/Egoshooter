@echo off
cd /d "%~dp0"
echo Multiplayer mit Cloudflare Tunnel starten.
echo Dieses Fenster und den PC waehrend des Spielens geoeffnet lassen.
call npm run host:multiplayer
pause
