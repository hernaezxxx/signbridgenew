@echo off
title Sign Bridge - Voice to Text Assistive System
echo =======================================================
echo Starting Sign Bridge - Automatic Voice-to-Text Display
echo Designed for Deaf users reading spoken voice in real time
echo =======================================================
echo Opening http://localhost:8080 in Chrome or Edge...
start http://localhost:8080
echo.
echo Running local server. Keep this window open!
node server.js
pause
