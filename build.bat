@echo off

xcopy ..\mimurl\package.json node_modules\mimurl\ /i /y /d >nul
xcopy ..\mimurl\dist\*.* node_modules\mimurl\dist\ /s /i /y /d >nul

webpack --display-error-details
