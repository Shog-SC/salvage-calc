@echo off
cd /d "%~dp0"

set /p msg=Entrez le message du commit : 

if "%msg%"=="" (
    echo Message vide. Commit annulé.
    pause
    exit /b
)

git status
git add .
git commit -m "%msg%"
git push

echo.
echo Commit et push termines.
pause
