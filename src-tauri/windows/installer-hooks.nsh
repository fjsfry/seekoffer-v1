; Keep the official Tauri NSIS template and extend only the lifecycle points it
; explicitly exposes. This preserves /S, /P, /UPDATE and /R behaviour used by
; unattended installs and the in-app updater.
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_WELCOMEPAGE_TITLE "$(seekofferWelcomeTitle)"
!define MUI_WELCOMEPAGE_TEXT "$(seekofferWelcomeText)"
!define MUI_FINISHPAGE_TITLE "$(seekofferFinishTitle)"
!define MUI_FINISHPAGE_TEXT "$(seekofferFinishText)"

!macro NSIS_HOOK_PREINSTALL
  ${If} $UpdateMode = 1
    DetailPrint "$(seekofferUpdating)"
  ${Else}
    DetailPrint "$(seekofferPreparing)"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ${If} $UpdateMode = 1
    DetailPrint "$(seekofferUpdateFinalizing)"
  ${Else}
    DetailPrint "$(seekofferFinalizing)"
  ${EndIf}
!macroend

; Tauri's NSIS template already removes the HKCU Run value on a real uninstall.
; The autostart dependency also writes StartupApproved\Run, so remove that
; exact product-owned value while preserving it during an in-place update.
!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "$(seekofferRemoving)"
  ${If} $UpdateMode <> 1
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "${PRODUCTNAME}"
  ${EndIf}
!macroend
