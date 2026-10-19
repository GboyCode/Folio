; Folio's compact, monochrome installer. The Tauri template retains file copying,
; WebView2 setup, shortcuts, registry, restart handling and uninstallation.
!include nsDialogs.nsh
!include WinMessages.nsh

Var FolioPage
Var FolioWidth
Var FolioHeight
Var FolioTitleFont
Var FolioBodyFont
Var FolioSmallFont
Var FolioLogo
Var FolioBitmap
Var FolioPath
Var FolioBrowse
Var FolioPathLabel
Var FolioExpanded
Var FolioPrimary
Var FolioClose
Var FolioFinished

!macro FolioLabel X Y W H TEXT FONT COLOR
  ${NSD_CreateLabel} ${X} ${Y} ${W} ${H} "${TEXT}"
  Pop $0
  ${NSD_AddStyle} $0 ${SS_CENTER}
  SetCtlColors $0 ${COLOR} FFFFFF
  SendMessage $0 ${WM_SETFONT} ${FONT} 1
!macroend

Function FolioGuiInit
  SetCtlColors $HWNDPARENT 242426 FFFFFF
  System::Call 'user32::GetDpiForWindow(p $HWNDPARENT) i .r0'
  ${If} $0 == 0
    StrCpy $0 96
  ${EndIf}
  IntOp $FolioWidth 600 * $0
  IntOp $FolioWidth $FolioWidth / 96
  IntOp $FolioHeight 450 * $0
  IntOp $FolioHeight $FolioHeight / 96
  System::Call 'user32::GetWindowLong(p $HWNDPARENT, i -16) i .r1'
  IntOp $1 $1 & 0xFF3BFFFF
  System::Call 'user32::SetWindowLong(p $HWNDPARENT, i -16, i r1)'
  System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i 0, i 0, i $FolioWidth, i $FolioHeight, i 0x26)'
  CreateFont $FolioTitleFont "Segoe UI" 27 700
  CreateFont $FolioBodyFont "微软雅黑" 11 400
  CreateFont $FolioSmallFont "微软雅黑" 9 400
  InitPluginsDir
  File /oname=$PLUGINSDIR\folio-logo.bmp "${FOLIO_UI_DIR}\logo.bmp"
  File /oname=$PLUGINSDIR\folio-controls.dll "${FOLIO_UI_DIR}\controls.dll"
  System::Call 'kernel32::LoadLibrary(w "$PLUGINSDIR\folio-controls.dll") p .r0'
  Call FolioHideChrome
FunctionEnd

Function FolioHideChrome
  ; Hide the stock header, divider, branding and wizard navigation.
  GetDlgItem $0 $HWNDPARENT 1
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 2
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 3
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1034
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1035
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1036
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1037
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1038
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1039
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1028
  ShowWindow $0 ${SW_HIDE}
  GetDlgItem $0 $HWNDPARENT 1256
  ShowWindow $0 ${SW_HIDE}
FunctionEnd

Function FolioPageBase
  Call FolioHideChrome
  System::Call 'user32::MoveWindow(p $FolioPage, i 0, i 0, i $FolioWidth, i $FolioHeight, i 1)'
  SetCtlColors $FolioPage 242426 FFFFFF
  ${NSD_CreateLabel} 2% 0 83% 10% ""
  Pop $0
  SetCtlColors $0 242426 FFFFFF
  ${NSD_AddStyle} $0 ${SS_NOTIFY}
  ${NSD_OnClick} $0 FolioDrag
  ${NSD_CreateButton} 85% 2% 6% 7% "—"
  Pop $0
  System::Call '$PLUGINSDIR\folio-controls.dll::StyleButton(p r0, i 0)'
  ${NSD_OnClick} $0 FolioMinimize
  ${NSD_CreateButton} 92% 2% 6% 7% "×"
  Pop $FolioClose
  System::Call '$PLUGINSDIR\folio-controls.dll::StyleButton(p $FolioClose, i 0)'
  ${NSD_OnClick} $FolioClose FolioCancel
  ${NSD_CreateBitmap} 44% 15% 12% 16% ""
  Pop $FolioLogo
  ${NSD_SetStretchedImage} $FolioLogo "$PLUGINSDIR\folio-logo.bmp" $FolioBitmap
  !insertmacro FolioLabel 10% 35% 80% 10% "Folio" $FolioTitleFont 242426
  !insertmacro FolioLabel 10% 47% 80% 7% "你的全球信息册，留在自己手中。" $FolioBodyFont 71717A
  ${NSD_CreateLabel} 6% 91% 65% 5% "本地存储  ·  自由选择数据位置"
  Pop $0
  SetCtlColors $0 91919A FFFFFF
  SendMessage $0 ${WM_SETFONT} $FolioSmallFont 1
FunctionEnd

Function FolioDrag
  Pop $0
  System::Call 'user32::ReleaseCapture()'
  SendMessage $HWNDPARENT ${WM_SYSCOMMAND} 0xF012 0
FunctionEnd

Function FolioMinimize
  Pop $0
  ShowWindow $HWNDPARENT ${SW_MINIMIZE}
FunctionEnd

Function FolioCancel
  Pop $0
  ${If} $FolioFinished == 1
    Call FolioComplete
    Return
  ${EndIf}
  SendMessage $HWNDPARENT ${WM_COMMAND} 2 0
FunctionEnd

Function FolioAbort
  ${If} $FolioFinished == 1
    Return
  ${EndIf}
  MessageBox MB_YESNO|MB_ICONQUESTION "退出 Folio 安装？" IDYES +2
  Abort
FunctionEnd

Function FolioWelcome
  ${If} $PassiveMode == 1
    Abort
  ${EndIf}
  nsDialogs::Create 1018
  Pop $FolioPage
  Call FolioPageBase
  ${NSD_CreateButton} 31% 61% 38% 11% "安装 Folio"
  Pop $FolioPrimary
  System::Call '$PLUGINSDIR\folio-controls.dll::StyleButton(p $FolioPrimary, i 1)'
  SendMessage $FolioPrimary ${WM_SETFONT} $FolioBodyFont 1
  SetCtlColors $FolioPrimary FFFFFF 242426
  ${NSD_OnClick} $FolioPrimary FolioStart
  ReadRegStr $0 SHCTX "${UNINSTKEY}" "DisplayVersion"
  ${If} $0 != ""
    ${NSD_SetText} $FolioPrimary "更新 Folio"
    !insertmacro FolioLabel 15% 74% 70% 5% "v${VERSION} · 保留已有数据和个人设置" $FolioSmallFont 91919A
  ${Else}
    !insertmacro FolioLabel 15% 74% 70% 5% "v${VERSION} · Windows 本地版" $FolioSmallFont 91919A
  ${EndIf}
  ${NSD_CreateLink} 77% 91% 18% 6% "自定义安装"
  Pop $0
  SetCtlColors $0 71717A FFFFFF
  SendMessage $0 ${WM_SETFONT} $FolioSmallFont 1
  ${NSD_OnClick} $0 FolioTogglePath
  ${NSD_CreateLabel} 10% 81% 14% 5% "安装位置"
  Pop $FolioPathLabel
  SetCtlColors $FolioPathLabel 71717A FFFFFF
  SendMessage $FolioPathLabel ${WM_SETFONT} $FolioSmallFont 1
  ${NSD_CreateDirRequest} 25% 80% 51% 7% "$INSTDIR"
  Pop $FolioPath
  SendMessage $FolioPath ${WM_SETFONT} $FolioSmallFont 1
  ${NSD_CreateBrowseButton} 78% 80% 12% 7% "更改"
  Pop $FolioBrowse
  SendMessage $FolioBrowse ${WM_SETFONT} $FolioSmallFont 1
  System::Call '$PLUGINSDIR\folio-controls.dll::StyleButton(p $FolioBrowse, i 0)'
  ${NSD_OnClick} $FolioBrowse FolioBrowsePath
  Call FolioSyncPath
  ${NSD_SetFocus} $FolioPrimary
  nsDialogs::Show
  ${NSD_FreeImage} $FolioBitmap
FunctionEnd

Function FolioStart
  Pop $0
  SendMessage $HWNDPARENT ${WM_COMMAND} 1 0
FunctionEnd

Function FolioTogglePath
  Pop $0
  IntOp $FolioExpanded $FolioExpanded ^ 1
  Call FolioSyncPath
FunctionEnd

Function FolioSyncPath
  ShowWindow $FolioPath $FolioExpanded
  ShowWindow $FolioBrowse $FolioExpanded
  ShowWindow $FolioPathLabel $FolioExpanded
FunctionEnd

Function FolioBrowsePath
  Pop $0
  nsDialogs::SelectFolderDialog "选择 Folio 安装位置" "$INSTDIR"
  Pop $0
  ${If} $0 != error
    ${GetFileName} "$0" $1
    ${If} $1 == "Folio"
      ${NSD_SetText} $FolioPath "$0"
    ${Else}
      ${NSD_SetText} $FolioPath "$0\Folio"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function FolioWelcomeLeave
  ${NSD_GetText} $FolioPath $0
  ${GetRoot} "$0" $1
  ${If} $1 == ""
  ${OrIf} $0 == $1
  ${OrIf} $0 == "$1\"
    MessageBox MB_ICONEXCLAMATION "请选择有效的程序文件夹。"
    Abort
  ${EndIf}
  StrCpy $INSTDIR $0
FunctionEnd

Function FolioProgressShow
  Call FolioHideChrome
  SetCtlColors $mui.InstFilesPage 242426 FFFFFF
  ; Keep NSIS's real progress and details, with a compact white presentation.
  !insertmacro MUI_HEADER_TEXT "正在安装 Folio" "请稍候，即将准备就绪。"
  GetDlgItem $0 $HWNDPARENT 1037
  ShowWindow $0 ${SW_SHOW}
  GetDlgItem $0 $HWNDPARENT 1038
  ShowWindow $0 ${SW_SHOW}
  SetCtlColors $mui.InstFilesPage.Text 71717A FFFFFF
  System::Call 'uxtheme::SetWindowTheme(p $mui.InstFilesPage.ProgressBar, w "", w "")'
  SendMessage $mui.InstFilesPage.ProgressBar 0x0409 0 0x262424
  SendMessage $mui.InstFilesPage.ProgressBar 0x2001 0 0xF4F4F5
  SetAutoClose true
FunctionEnd

Function FolioFinish
  ${If} $PassiveMode == 1
    Abort
  ${EndIf}
  StrCpy $FolioFinished 1
  Call CreateOrUpdateDesktopShortcut
  nsDialogs::Create 1018
  Pop $FolioPage
  Call FolioPageBase
  !insertmacro FolioLabel 10% 57% 80% 6% "安装完成，一切就绪。" $FolioBodyFont 52525B
  ${NSD_CreateButton} 31% 67% 38% 11% "打开 Folio"
  Pop $FolioPrimary
  System::Call '$PLUGINSDIR\folio-controls.dll::StyleButton(p $FolioPrimary, i 1)'
  SendMessage $FolioPrimary ${WM_SETFONT} $FolioBodyFont 1
  SetCtlColors $FolioPrimary FFFFFF 242426
  ${NSD_OnClick} $FolioPrimary FolioLaunch
  ${NSD_SetFocus} $FolioPrimary
  nsDialogs::Show
  ${NSD_FreeImage} $FolioBitmap
FunctionEnd

Function FolioLaunch
  Pop $0
  ; This is a current-user installer: launch the selected installed executable
  ; directly and report failures instead of silently dismissing the completion page.
  IfFileExists "$INSTDIR\${MAINBINARYNAME}.exe" +3 0
    MessageBox MB_ICONEXCLAMATION "未找到 Folio，请重新安装后再试。"
    Return
  ClearErrors
  Exec '"$INSTDIR\${MAINBINARYNAME}.exe"'
  ${If} ${Errors}
    MessageBox MB_ICONEXCLAMATION "暂时无法打开 Folio，请从桌面快捷方式启动。"
    Return
  ${EndIf}
  Call FolioComplete
FunctionEnd

Function FolioComplete
  ; Quit inside an nsDialogs callback only stops that script callback; Show
  ; still owns a message loop. Post the native Finish action so it can unwind.
  System::Call 'user32::PostMessage(p $HWNDPARENT, i ${WM_COMMAND}, p 1, p 0)'
FunctionEnd
