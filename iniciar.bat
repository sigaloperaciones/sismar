@echo off
title SISMAR - Sistema de Correspondencia
color 0A

echo.
echo  ============================================
echo   SISMAR - Sistema de Gestion de Correspondencia
echo  ============================================
echo.

:: -- 1. Liberar puerto 3000 si está ocupado ---------------------------------
echo  [1/3] Liberando puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo        Puerto 3000 libre.

:: -- 2. Limpiar caché de Next.js --------------------------------------------
echo  [2/3] Limpiando cache de Next.js...
if exist ".next" (
    rmdir /s /q ".next"
    echo        Carpeta .next eliminada.
) else (
    echo        Sin cache previa.
)

:: -- 3. Verificar dependencias ----------------------------------------------
echo  [3/3] Verificando dependencias...
if not exist "node_modules" (
    echo        node_modules no encontrado. Instalando...
    call npm install
) else (
    echo        Dependencias OK.
)

:: -- Iniciar servidor -------------------------------------------------------
echo.
echo  ============================================
echo   Servidor iniciando en http://localhost:3000
echo   Presiona Ctrl+C para detener
echo  ============================================
echo.

cd /d "%~dp0"
start http://localhost:3000
npm run dev

pause
