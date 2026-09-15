@echo off
REM Nightly database backup, made to be run by Windows Task Scheduler.
REM
REM Anything passed to this file is handed to the backup script, so the same
REM file covers both databases:
REM
REM   nightly-backup.bat            -> the local database (DATABASE_URL)
REM   nightly-backup.bat --remote   -> the live online one (TARGET_DATABASE_URL
REM                                    in .env.remote)
REM
REM Task Scheduler setup:
REM   Program/script:  C:\Windows\System32\cmd.exe
REM   Arguments:       /c "<full path to this file>"
REM                    /c "<full path to this file> --remote"
REM   Start in:        <the backend folder>
REM   Trigger:         daily, at an hour the bar is closed (e.g. 04:00)
REM   Check "Run whether user is logged on or not".
REM
REM When the bar runs online, the --remote task is the one that matters: that
REM is where the real data lives. Set up both if there is a local copy too.
REM
REM Every run appends to backups\backup-log.txt - check that file now and then
REM to be sure the backups are actually happening.

cd /d "%~dp0"

if not exist backups mkdir backups

echo. >> backups\backup-log.txt
echo ==== %DATE% %TIME% ==== backup %* >> backups\backup-log.txt

call npm run backup:db -- %* >> backups\backup-log.txt 2>&1

if errorlevel 1 (
    echo BACKUP FAILED - see the error above >> backups\backup-log.txt
    exit /b 1
)

exit /b 0
