@echo off
title SISMAR - Publicar en GitHub
color 0B
chcp 65001 >nul

echo.
echo  ============================================
echo   SISMAR - Publicar cambios en GitHub
echo   Repositorio: AISerNet-Company/SISMAR
echo  ============================================
echo.

:: -- Verificar que estamos en un repositorio git -----------------------------
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Esta carpeta no es un repositorio git.
    echo          Ejecuta este script desde la raiz del proyecto.
    echo.
    pause
    exit /b 1
)

:: -- Verificar conexion con GitHub -------------------------------------------
echo  [1/4] Verificando conexion con GitHub...
git fetch origin >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] No se pudo conectar con GitHub.
    echo          Verifica tu conexion a internet y tus credenciales.
    echo.
    pause
    exit /b 1
)
echo         Conexion OK.
echo.

:: -- Mostrar estado de cambios -----------------------------------------------
echo  [2/4] Cambios pendientes de publicar:
echo  ----------------------------------------
git status --short
echo  ----------------------------------------
echo.

:: -- Verificar si hay algo que commitear -------------------------------------
git diff --quiet --exit-code >nul 2>&1
git diff --cached --quiet --exit-code >nul 2>&1
git status --porcelain | findstr /r "." >nul 2>&1
if errorlevel 1 (
    color 0E
    echo  [INFO] No hay cambios nuevos para publicar.
    echo.

    :: Verificar si hay commits locales sin push
    git log origin/main..HEAD --oneline 2>nul | findstr /r "." >nul 2>&1
    if not errorlevel 1 (
        echo  Hay commits locales pendientes de push. Continuando...
        goto :dopush
    )

    echo  El repositorio esta al dia con GitHub.
    echo.
    pause
    exit /b 0
)

:: -- Pedir mensaje del commit ------------------------------------------------
echo  [3/4] Mensaje del commit:
echo.
set /p COMMIT_MSG=         Descripcion (ej: fix: correccion en login):
echo.

if "%COMMIT_MSG%"=="" (
    color 0C
    echo  [ERROR] El mensaje del commit no puede estar vacio.
    echo.
    pause
    exit /b 1
)

:: -- Agregar y hacer commit --------------------------------------------------
git add .
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Fallo al crear el commit.
    echo.
    pause
    exit /b 1
)
echo.

:: -- Push a GitHub -----------------------------------------------------------
:dopush
echo  [4/4] Subiendo a GitHub...
git push origin main
if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Fallo al subir a GitHub.
    echo          Es posible que necesites autenticarte.
    echo          Intenta correr: git push origin main
    echo.
    pause
    exit /b 1
)

:: -- Exito -------------------------------------------------------------------
color 0A
echo.
echo  ============================================
echo   OK - Cambios publicados exitosamente
echo  ============================================
git log --oneline -3
echo.
echo   Ver en: https://github.com/AISerNet-Company/SISMAR
echo  ============================================
echo.
pause
