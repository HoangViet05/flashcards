@echo off
echo Starting FlashCards App...
echo.

start "FlashCards - Backend" cmd /k "cd /d %~dp0backend && pip install -r requirements.txt -q && uvicorn app.main:app --reload --port 8000"

timeout /t 3 /nobreak > nul

start "FlashCards - Frontend" cmd /k "cd /d %~dp0frontend && npm install --silent && npm run dev"

echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Both services are starting in separate windows.
pause
