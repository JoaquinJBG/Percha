@echo off
rem Arranca el probador de Percha. Deja esta ventana abierta mientras lo uses.
set PYTHONUTF8=1
if "%PERCHA_VTON_DIR%"=="" set PERCHA_VTON_DIR=%USERPROFILE%\proyectos\Percha-vton
"%PERCHA_VTON_DIR%\.venv-cat\Scripts\python.exe" "%~dp0servidor.py"
