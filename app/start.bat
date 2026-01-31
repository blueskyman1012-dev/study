@echo off
echo ========================================
echo   오답헌터 시작
echo ========================================

cd /d C:\hjkim\app

:: Dev Server 실행
start cmd /k npm run dev

:: 5초 대기
timeout /t 5

:: ngrok 실행
start cmd /k ngrok http 9333

:: 3초 대기 후 브라우저
timeout /t 3
start http://localhost:9333

echo 완료
pause
