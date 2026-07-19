@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  if exist "%USERPROFILE%\anaconda3\envs\flashcard\python.exe" ("%USERPROFILE%\anaconda3\envs\flashcard\python.exe" -m venv .venv) else (py -3.12 -m venv .venv)
)
call .venv\Scripts\activate.bat
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
if not exist .env copy .env.example .env
pause
