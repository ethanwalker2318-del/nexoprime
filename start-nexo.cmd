@echo off
chcp 65001 >nul
title NEXO Prime — Launcher
color 0A

echo ============================================
echo         NEXO PRIME — FULL START
echo ============================================
echo.

:: ─── Пути ───────────────────────────────────
set PROJECT_DIR=%~dp0
set BACKEND_DIR=%PROJECT_DIR%backend

:: ─── 1. Проверка Node.js ────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js не найден! Установите Node.js
    pause
    exit /b 1
)
echo [OK] Node.js: 
node -v

:: ─── 2. Проверка PM2 ────────────────────────
where pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo [INSTALL] Устанавливаю PM2...
    call npm install -g pm2
)
echo [OK] PM2 доступен

:: ─── 3. Проверка cloudflared ─────────────────
if not exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
    echo [WARN] cloudflared не найден в стандартном пути
    echo        Туннель может не запуститься
) else (
    echo [OK] cloudflared доступен
)

:: ─── 4. Установка зависимостей (если нужно) ──
if not exist "%PROJECT_DIR%node_modules" (
    echo [INSTALL] Устанавливаю frontend зависимости...
    cd /d "%PROJECT_DIR%"
    call npm install
)

if not exist "%BACKEND_DIR%\node_modules" (
    echo [INSTALL] Устанавливаю backend зависимости...
    cd /d "%BACKEND_DIR%"
    call npm install
)

:: ─── 5. Prisma generate ──────────────────────
echo [DB] Генерирую Prisma Client...
cd /d "%BACKEND_DIR%"
call npx prisma generate >nul 2>&1
echo [OK] Prisma Client готов

:: ─── 6. Билд фронтенда ──────────────────────
echo [BUILD] Собираю фронтенд...
cd /d "%PROJECT_DIR%"
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Билд фронтенда не удался!
    pause
    exit /b 1
)
echo [OK] Фронтенд собран

:: ─── 7. Остановка старых процессов PM2 ───────
echo [PM2] Останавливаю старые процессы...
pm2 delete all >nul 2>&1

:: ─── 8. Запуск через ecosystem ───────────────
echo [PM2] Запускаю nexo-backend + nexo-tunnel...
cd /d "%PROJECT_DIR%"
pm2 start ecosystem.config.cjs

:: ─── 9. Сохранение для автозапуска ───────────
pm2 save >nul 2>&1

echo.
echo ============================================
echo         ВСЕ ЗАПУЩЕНО УСПЕШНО!
echo ============================================
echo.
echo   Backend:   http://localhost:3000
echo   Tunnel:    https://nexo-api.auraglobal-merchants.com
echo   Mini App:  https://ethanwalker2318-del.github.io/nexoprime/
echo.
echo   Ctrl+C — выйти из логов (процессы продолжат работать)
echo   pm2 stop all — остановить все
echo ============================================
echo.

:: ─── 10. Ждём 3 сек, чтобы процессы поднялись ─
timeout /t 3 /nobreak >nul

:: ─── 11. Показываем статус ───────────────────
pm2 status

echo.
echo ──── LIVE ЛОГИ (Ctrl+C для выхода) ────
echo.

:: ─── 12. Стримим логи в реальном времени ─────
pm2 logs --raw
