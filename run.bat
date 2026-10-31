@echo off
title PulseCommerce Dashboard Launcher
echo ========================================================
echo   Launching PulseCommerce Operations Dashboard...
echo ========================================================
echo.

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Python detected. Starting local server on http://[IP_ADDRESS] ...
    python server.py
) else (
    echo Python not found in PATH. Opening index.html directly in default browser...
    start "" "index.html"
)
pause
