@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (echo Chua cai worker. Hay chay install_shadowing.bat truoc.& pause & exit /b 1)
call .venv\Scripts\activate.bat
set "PATH=%CD%\.venv\Lib\site-packages\nvidia\cublas\bin;%CD%\.venv\Lib\site-packages\nvidia\cudnn\bin;%PATH%"
echo Shadowing worker dang BAT tai http://127.0.0.1:8788
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8788
pause
