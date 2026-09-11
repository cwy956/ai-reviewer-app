@echo off
setlocal
cd /d "%~dp0"

echo ===============================================
echo   AI 심사역 데모 실행 스크립트
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 후 이 파일을 다시 실행하세요.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [오류] .env.local 파일이 없습니다. ANTHROPIC_API_KEY를 설정해야 합니다.
  echo .env.local.example을 참고해 .env.local을 만들어주세요.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo 의존성 설치 중입니다... 인터넷이 필요하고 몇 분 걸릴 수 있습니다.
  call npm install
  if errorlevel 1 (
    echo [오류] npm install 실패. 인터넷 연결을 확인하세요.
    pause
    exit /b 1
  )
)

if not exist ".next" (
  echo 처음 실행이라 빌드가 필요합니다...
  call npm run build
  if errorlevel 1 (
    echo [오류] 빌드 실패.
    pause
    exit /b 1
  )
)

echo.
echo 서버를 시작합니다. 잠시 후 브라우저가 자동으로 열립니다.
echo 데모를 마치면 이 창을 닫아서 서버를 종료하세요.
echo.

start "" http://localhost:3000
call npm start

pause
