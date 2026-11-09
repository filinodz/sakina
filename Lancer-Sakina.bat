@echo off
chcp 65001 >nul
title Sakina - Ecran de priere
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js est requis : https://nodejs.org & pause & exit /b 1)
if not exist node_modules (echo Installation des dependances... & call npm install || (pause & exit /b 1))
echo Demarrage de Sakina sur http://localhost:4173 ...
call npm start
pause
