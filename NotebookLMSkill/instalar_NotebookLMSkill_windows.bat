@echo off
chcp 65001 >nul
cls

echo.
echo ============================================
echo    Instalador NotebookLMSkill
echo    Centeia Education
echo ============================================
echo.
echo Este proceso instala todo lo necesario para
echo conectar Claude Code con NotebookLM.
echo.
echo En unos momentos puede pedirte login en Google.
echo.
pause
echo.

:: ────────────────────────────────────────────
:: PASO 1 — Comprobar Python
:: ────────────────────────────────────────────
echo [1/4] Comprobando Python...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   Python no encontrado.
    echo.
    echo   Necesitas instalarlo antes de continuar:
    echo.
    echo   1. Ve a: https://www.python.org/downloads/
    echo   2. Descarga Python 3.12
    echo   3. En el instalador, MARCA:
    echo      "Add Python to PATH"  ^<-- MUY IMPORTANTE
    echo   4. Instala y cierra el instalador
    echo   5. Vuelve a ejecutar este archivo
    echo.
    echo   Abriendo la pagina de descarga...
    start https://www.python.org/downloads/
    echo.
    pause
    exit /b 1
)

:: Comprobar versión mínima 3.10
for /f "tokens=2 delims= " %%v in ('python --version 2^>^&1') do set PYVER=%%v
for /f "tokens=1,2 delims=." %%a in ("%PYVER%") do (
    set PYMAJOR=%%a
    set PYMINOR=%%b
)

if %PYMAJOR% lss 3 goto :python_old
if %PYMAJOR% equ 3 if %PYMINOR% lss 10 goto :python_old
echo   v Python %PYVER% encontrado.
goto :python_ok

:python_old
echo.
echo   Python %PYVER% es demasiado antiguo. Necesitas 3.10 o superior.
echo.
echo   Descarga Python 3.12 desde: https://www.python.org/downloads/
echo   IMPORTANTE: marca "Add Python to PATH" durante la instalacion.
echo.
start https://www.python.org/downloads/
pause
exit /b 1

:python_ok

:: ────────────────────────────────────────────
:: PASO 2 — Política de PowerShell
:: ────────────────────────────────────────────
echo.
echo [2/4] Configurando PowerShell...
powershell -Command "Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force" >nul 2>&1
echo   v Configuracion correcta.

:: ────────────────────────────────────────────
:: PASO 3 — Instalar notebooklm-py
:: ────────────────────────────────────────────
echo.
echo [3/4] Instalando notebooklm-py (3-7 minutos, es normal que tarde)...
echo       No cierres esta ventana.
echo.

python -m venv "%USERPROFILE%\.notebooklm-venv"
if %errorlevel% neq 0 (
    echo   x Error creando el entorno virtual.
    pause
    exit /b 1
)

"%USERPROFILE%\.notebooklm-venv\Scripts\pip.exe" install --quiet --upgrade pip
"%USERPROFILE%\.notebooklm-venv\Scripts\pip.exe" install "notebooklm-py[browser]"
if %errorlevel% neq 0 (
    echo   x Error instalando notebooklm-py.
    pause
    exit /b 1
)

"%USERPROFILE%\.notebooklm-venv\Scripts\playwright.exe" install chromium
if %errorlevel% neq 0 (
    echo   x Error instalando Chromium.
    pause
    exit /b 1
)

echo.
echo   v notebooklm-py instalado correctamente.

:: ────────────────────────────────────────────
:: PASO 4 — Verificación
:: ────────────────────────────────────────────
echo.
echo [4/4] Verificando instalacion...

"%USERPROFILE%\.notebooklm-venv\Scripts\notebooklm.exe" --help >nul 2>&1
if %errorlevel% neq 0 (
    echo   x Algo ha fallado en la verificacion.
    echo     Comparte este error en la comunidad de Centeia Education.
    pause
    exit /b 1
)

echo   v Todo funciona correctamente.

:: ────────────────────────────────────────────
:: FIN
:: ────────────────────────────────────────────
echo.
echo ============================================
echo   v Instalacion completada correctamente
echo ============================================
echo.
echo Pasos siguientes:
echo   1. Abre Claude Code
echo   2. Sube el archivo NotebookLMSkill_Windows.md como skill
echo   3. Escribe: instala notebooklm
echo   4. Se abrira un navegador, inicia sesion en Google
echo   5. Vuelve a Claude Code y confirma que ya estas dentro
echo.
echo Dudas? ^-^> centeia.com
echo.
pause
