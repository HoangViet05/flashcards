@echo off
cd /d "%~dp0"
if not exist .env (
  echo Chua co file .env. Hay copy .env.example thanh .env va dan ma ket noi tu Tech Reader.
  pause
  exit /b 1
)
if not exist .venv\Scripts\python.exe (
  echo Chua tim thay .venv cua worker. Hay chay lai install_worker.bat sau khi cap nhat script.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
.venv\Scripts\python.exe worker.py
pause
