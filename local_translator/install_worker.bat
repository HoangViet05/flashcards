@echo off
setlocal
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
  echo Dang tao moi truong Python rieng cho worker...
  if exist "%USERPROFILE%\anaconda3\envs\flashcard\python.exe" (
    "%USERPROFILE%\anaconda3\envs\flashcard\python.exe" -m venv .venv
  ) else (
    py -3.12 -m venv .venv
  )
  if errorlevel 1 (
    echo Khong tao duoc .venv. Can Python 3.10 - 3.13; Python 3.14 hien chua duoc dung cho worker.
    pause
    exit /b 1
  )
)

if not exist .venv\Scripts\python.exe (
  echo Khong tim thay .venv\Scripts\python.exe sau khi tao moi truong.
  pause
  exit /b 1
)

call .venv\Scripts\activate.bat
.venv\Scripts\python.exe -m pip install --upgrade pip
REM RTX 4060: install the official CUDA 12.6 wheel, never the CPU-only wheel from PyPI.
.venv\Scripts\python.exe -m pip install --upgrade --force-reinstall torch --index-url https://download.pytorch.org/whl/cu126
.venv\Scripts\python.exe -m pip install -r requirements.txt

if errorlevel 1 (
  echo Cai dat thu vien that bai. Hay kiem tra ket noi Internet va chay lai file nay.
  pause
  exit /b 1
)

echo.
echo Cai dat xong. Kiem tra GPU bang lenh:
echo .venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CUDA not available')"
echo Neu ket qua dau tien la False, cai PyTorch CUDA dung voi driver NVIDIA tai https://pytorch.org/get-started/locally/
pause
