@echo off
setlocal
for /f "usebackq delims=" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do set "FOLIO_VS=%%i"
if not defined FOLIO_VS exit /b 1
call "%FOLIO_VS%\Common7\Tools\VsDevCmd.bat" -arch=x86 -host_arch=x64 >nul
if errorlevel 1 exit /b 1
cl /nologo /LD /MT /O1 /EHsc /utf-8 /DUNICODE /D_UNICODE src-tauri\installer\controls.cpp /Fo:src-tauri\installer\controls.obj /link /DEF:src-tauri\installer\controls.def /OUT:src-tauri\installer\controls.dll /IMPLIB:src-tauri\installer\controls.lib user32.lib gdi32.lib comctl32.lib gdiplus.lib
exit /b %errorlevel%
