@echo off
chcp 65001 >nul
setlocal
pushd "%~dp0"
call npm run release
set "release_result=%errorlevel%"
if not "%release_result%"=="0" echo 修复提示的问题后重新运行；云端失败可在 GitHub Actions 中重试。
popd
pause
exit /b %release_result%
