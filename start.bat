@echo off
echo Starting Flashcard App...

start "Backend" cmd /k "conda activate flashcard && cd backend && uvicorn app.main:app --reload --port 8000"
start "Frontend" cmd /k "conda activate flashcard && cd frontend && npm run dev"

echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
