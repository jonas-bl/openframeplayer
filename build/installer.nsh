; Adds a direct right-click entry "Open with FramePlayer" for video files.
;
; Registered under HKCU\...\SystemFileAssociations\<ext>\shell so it shows in
; the context menu without replacing the user's default app. The command passes
; the clicked file as %1; the app's single-instance + argv handling loads it.

!macro RegVideoContext ext
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\FramePlayerOpen" "" "Open with FramePlayer"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\FramePlayerOpen" "Icon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\FramePlayerOpen\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
!macroend

!macro UnregVideoContext ext
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\${ext}\shell\FramePlayerOpen"
!macroend

!macro customInstall
  !insertmacro RegVideoContext ".mp4"
  !insertmacro RegVideoContext ".mkv"
  !insertmacro RegVideoContext ".mov"
  !insertmacro RegVideoContext ".avi"
  !insertmacro RegVideoContext ".webm"
  !insertmacro RegVideoContext ".m4v"
  !insertmacro RegVideoContext ".wmv"
  !insertmacro RegVideoContext ".flv"
  !insertmacro RegVideoContext ".ts"
!macroend

!macro customUnInstall
  !insertmacro UnregVideoContext ".mp4"
  !insertmacro UnregVideoContext ".mkv"
  !insertmacro UnregVideoContext ".mov"
  !insertmacro UnregVideoContext ".avi"
  !insertmacro UnregVideoContext ".webm"
  !insertmacro UnregVideoContext ".m4v"
  !insertmacro UnregVideoContext ".wmv"
  !insertmacro UnregVideoContext ".flv"
  !insertmacro UnregVideoContext ".ts"
!macroend
