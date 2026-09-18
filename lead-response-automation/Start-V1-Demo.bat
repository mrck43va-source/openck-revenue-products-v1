@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0Start-V1-Demo.ps1"
