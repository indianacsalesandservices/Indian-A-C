@echo off
title Indian A/C - Unified Encrypted Server
echo.
echo ============================================================
echo   INDIAN A/C SALES ^& SERVICES - Unified Encrypted Server
echo ============================================================
echo.
echo   Starting server on http://localhost:5000
echo.
echo   Portal:     http://localhost:5000/
echo   Attendance: http://localhost:5000/attendance/
echo   Complaints: http://localhost:5000/complaints/
echo   Billing:    http://localhost:5000/billing/
echo   Logs:       http://localhost:5000/attendance-log.html
echo.
echo   Portal login: Ramesh / Indiana/c (admin)
echo   Staff login:  staff / staff123
echo.
echo   Press Ctrl+C to stop the server
echo ============================================================
echo.
cd /d "%~dp0"
"C:\Users\TONY\AppData\Local\Python\pythoncore-3.14-64\python.exe" server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Trying default python...
    python server.py
)
pause
