@echo off
title ระบบคลังข้อสอบ (exam-bank)
cd /d "%~dp0"
echo กำลังเริ่มต้นระบบคลังข้อสอบ...
echo กรุณารอสักครู่ ระบบจะเปิดเว็บเบราว์เซอร์ให้อัตโนมัติที่ http://localhost:8080
echo.
npm run dev
pause
