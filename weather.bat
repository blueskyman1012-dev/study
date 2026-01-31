@echo off
chcp 65001 >nul
title 오늘의 날씨
curl -s "wttr.in/Seoul?format=3&lang=ko"
echo.
curl -s "wttr.in/Seoul?format=%%t+%%C&lang=ko"
echo.
echo 좋은 하루 되세요!
echo.
pause
