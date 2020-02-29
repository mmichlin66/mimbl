@echo off

xcopy ..\mimcss\package.json node_modules\mimcss\ /i /y /d >nul
xcopy ..\mimcss\lib\*.* node_modules\mimcss\lib\ /s /i /y /d >nul

webpack -p --display-error-details

