@echo off
chcp 65001 >nul
title Trading Lab & Order Flow - Server Runner

echo ======================================================
echo       Trading Lab & Order Flow Platform
echo ======================================================
echo.

cd /d "%~dp0"

echo 1. Opening Trading Lab at: http://localhost:5173
start http://localhost:5173

echo 2. Launching Development Server...
echo.
npm run dev

pause
