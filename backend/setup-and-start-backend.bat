@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================
echo  Coffee Shop POS - backend setup
echo ============================================
echo.

if exist .env (
    echo A backend\.env file already exists - leaving it as is.
) else (
    (
        echo DATABASE_URL="mysql://root:@localhost:3306/coffee_shop_management"
        echo JWT_SECRET="4f348494c416469235b7f052e7d6b027d19649cea9bd3c42ceae9b27fccf7223e5c52bffce567b45824825428f4fe197"
        echo NODE_ENV="development"
        echo PORT=5000
        echo HOST=0.0.0.0
        echo CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"
        echo BACKEND_ENV_PATH=""
        echo API_DOCS_ENABLED="false"
        echo API_DOCS_USERNAME=""
        echo API_DOCS_PASSWORD=""
        echo GUEST_ORDER_PUBLIC_BASE_URL=""
        echo BACKUP_OUTPUT_DIR="./backups"
        echo BACKUP_SYNC_DIR=""
        echo REPORT_OUTPUT_DIR="./reports"
        echo REPORT_SYNC_DIR=""
        echo INVENTORY_ALERT_RETRY_MS=30000
    ) > .env
    echo Created backend\.env with local MySQL defaults.
    echo   (root user, no password, localhost:3306, database "coffee_shop_management")
    echo   If your MySQL is set up differently, close this window, edit backend\.env,
    echo   then run this script again.
)

echo.
echo ------------------------------------------------
echo Generating Prisma client...
echo ------------------------------------------------
call npx prisma generate
if errorlevel 1 goto :prismafail

echo.
echo ------------------------------------------------
echo Creating/updating database tables (prisma db push)...
echo ------------------------------------------------
call npx prisma db push
if errorlevel 1 goto :dbfail

echo.
echo ------------------------------------------------
echo Seeding demo staff/products (safe to skip errors if already seeded)...
echo ------------------------------------------------
call npm run seed:pos

echo.
echo ============================================
echo Setup done. Starting the backend server now.
echo Leave this window open while you use the app.
echo Press Ctrl+C to stop it.
echo ============================================
echo.
call npm run dev
goto :eof

:prismafail
echo.
echo ============================================
echo  Prisma client generation failed - see the error above.
echo ============================================
pause
goto :eof

:dbfail
echo.
echo ============================================
echo  Could not connect to MySQL / create tables.
echo  Most likely MySQL is not installed or not running,
echo  or the DATABASE_URL in backend\.env does not match
echo  your MySQL username/password.
echo
echo  Fix backend\.env and run this script again.
echo ============================================
pause
goto :eof
