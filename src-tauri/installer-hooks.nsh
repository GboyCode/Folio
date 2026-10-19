!define FOLIO_UI_DIR "${__FILEDIR__}\installer"

; Keep an existing startup preference pointing to the installed executable.
!macro NSIS_HOOK_POSTINSTALL
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Folio"
  ${If} $R0 != ""
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Folio" '"$INSTDIR\${MAINBINARYNAME}.exe"'
  ${EndIf}
!macroend

; A normal uninstall removes Folio's startup entry; upgrades retain it.
!macro NSIS_HOOK_POSTUNINSTALL
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Folio"
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Folio"
  ${EndIf}
!macroend
