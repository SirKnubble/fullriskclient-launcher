; NoRisk Launcher - NSIS Installer Hooks
; Extracts referral code from installer filename for tracking
; Works for affiliate links, friend referrals, etc.
;
; Expected filename format: NoRiskClient-Windows-setup-REFERRALCODE.exe
; Example: NoRiskClient-Windows-setup-550e8400-e29b-41d4.exe
;          NoRiskClient-Windows-setup-nqrman.exe

!include "WordFunc.nsh"

!macro NSIS_HOOK_POSTINSTALL
  ; Get the full path of the installer executable
  ; $EXEPATH contains the full path, we need just the filename
  Push $0
  Push $1
  Push $2
  Push $R0

  ; Get filename from path
  ${GetFileName} "$EXEPATH" $0

  ; Debug: Log the filename (visible in installer log)
  DetailPrint "Installer filename: $0"

  ; Find the last occurrence of "-setup-" to extract referral code
  ; Format: ...-setup-REFERRALCODE.exe
  StrCpy $1 ""
  StrCpy $2 ""

  ; Use WordFind to get everything after "-setup-"
  ; +2 = second word (after the delimiter), +1 would be first word (before delimiter)
  ${WordFind} $0 "-setup-" "+2" $1

  ; Check if we found something (if $1 equals $0, nothing was found)
  StrCmp $1 $0 no_referral_code
  StrCmp $1 "" no_referral_code

  ; Remove .exe extension
  ${WordFind} $1 ".exe" "+1" $2

  ; If $2 equals $1, the .exe wasn't found - use $1 as is but trim .exe manually
  StrCmp $2 $1 0 +3
    StrLen $R0 $1
    IntOp $R0 $R0 - 4
    StrCpy $2 $1 $R0

  ; Skip if empty or if it's just whitespace
  StrCmp $2 "" no_referral_code

  ; Write referral code to file in install directory
  DetailPrint "Referral code found: $2"
  FileOpen $R0 "$INSTDIR\referral_code.txt" w
  FileWrite $R0 $2
  FileClose $R0
  DetailPrint "Referral code saved to: $INSTDIR\referral_code.txt"
  Goto done_referral

  no_referral_code:
    DetailPrint "No referral code found in installer filename"

  done_referral:
  Pop $R0
  Pop $2
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_PREINSTALL
  ; No action needed before install
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Clean up referral code file on uninstall
  Delete "$INSTDIR\referral_code.txt"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; No action needed before uninstall
!macroend
