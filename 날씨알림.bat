@echo off
chcp 65001 > nul
title 오늘의 날씨

claude -p "오늘 서울 날씨를 간단히 알려줘. 온도, 날씨 상태, 옷차림 추천 포함해서 3-4줄로"

echo.
echo 좋은 하루 되세요!
echo.
pause
