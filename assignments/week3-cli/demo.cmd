@echo off
chcp 65001 >nul
"%~dp0bin\solana-account-cli.exe" demo
echo.
pause
