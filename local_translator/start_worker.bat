@echo off
cd /d "%~dp0"
if not exist .env (
  echo Chua co file .env. Hay copy .env.example thanh .env va dan ma ket noi tu Tech Reader.
  pause
  exit /b 1
)
if not exist .venv\Scripts\python.exe (
  echo Chua cai dat worker. Hay chay install_worker.bat mot lan truoc.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python worker.py
pause
