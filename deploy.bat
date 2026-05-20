@echo off
title Safwa Cemetery Deploy
color 0A

echo ======================================
echo   Safwa Cemetery - Deploy to Cloudflare
echo ======================================
echo.
echo IMPORTANT: A browser will open for login
echo Click ALLOW when you see Cloudflare auth page
echo.
pause

cd /d "%~dp0"

echo.
echo [Step 1/2] Login to Cloudflare...
call npx wrangler@latest login

echo.
echo [Step 2/2] Deploying site...
call npx wrangler@latest pages deploy . --project-name=safwa-cemetery --branch=main --commit-dirty=true

echo.
echo ======================================
echo   DONE! Copy the URL above
echo ======================================
echo.
pause
