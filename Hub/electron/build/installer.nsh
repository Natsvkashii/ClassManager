; HubDesk NSIS include (Hub/HUBDESK.md §6) - Authorship: Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com)
; The legacy ClassDesk updater runs this installer with "--silent": NSIS only knows /S, so map it to SetSilent.
; In silent mode electron-builder does not start the app unless --force-run is given: start HubDesk with --first-run ourselves
; (single-instance lock makes a second start harmless).
!macro customInit
  ClearErrors
  ${GetParameters} $R0
  ${GetOptions} $R0 "--silent" $R1
  ${IfNot} ${Errors}
    SetSilent silent
  ${EndIf}
  ClearErrors
!macroend

!macro customInstall
  ${If} ${Silent}
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --first-run'
  ${EndIf}
!macroend
