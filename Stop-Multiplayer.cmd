@echo off
cd /d "%~dp0"
node --import tsx scripts/host-multiplayer.ts --stop
pause
