@echo off
setlocal
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
  py -3.12 -m venv .venv
)

call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install torch
python -m pip install -r requirements.txt

echo.
echo Cai dat xong. Kiem tra GPU bang lenh:
echo .venv\Scripts\python.exe -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
echo Neu ket qua dau tien la False, cai PyTorch CUDA dung voi driver NVIDIA tai https://pytorch.org/get-started/locally/
pause
