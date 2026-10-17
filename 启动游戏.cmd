@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-game.ps1"
if errorlevel 1 pause
