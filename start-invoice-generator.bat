@echo off
setlocal

cd /d "%~dp0"

set "APP_URL=http://127.0.0.1:8000/"
set "VENV_DIR=%~dp0.venv"
set "PYTHON_EXE=%VENV_DIR%\Scripts\python.exe"

where py >nul 2>nul
if %errorlevel%==0 (
  set "PY_LAUNCHER=py -3"
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set "PY_LAUNCHER=python"
  ) else (
    echo Python was not found. Install Python 3, then run this file again.
    pause
    exit /b 1
  )
)

if not exist "%PYTHON_EXE%" (
  echo Creating local Python environment...
  %PY_LAUNCHER% -m venv "%VENV_DIR%"
  if errorlevel 1 (
    echo Could not create the local Python environment.
    pause
    exit /b 1
  )
)

echo Installing required packages into the local environment...
"%PYTHON_EXE%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo Could not install the required packages.
  pause
  exit /b 1
)

echo Starting invoice generator at %APP_URL%
start "Euclidean Invoice Generator Server" /min "%PYTHON_EXE%" app.py

timeout /t 2 /nobreak >nul
start "" "%APP_URL%"

echo The invoice generator is open in your browser.
echo Close the server window when you are done.
endlocal
