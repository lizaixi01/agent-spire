@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0"
call npm run release
set "release_result=%errorlevel%"
if not "%release_result%"=="0" echo 修复提示的问题后，在终端运行 npm run release -- --resume 继续。
popd
pause
exit /b %release_result%
