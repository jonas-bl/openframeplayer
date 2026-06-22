import { BrowserWindow } from 'electron'

/**
 * The bottom "video" window: an opaque host whose native window handle mpv
 * embeds into (`--wid`). mpv fills its content area, so this window has no web
 * UI of its own — just a black surface behind the video.
 *
 * It keeps the real OS window frame (native title bar, min/max/close, Snap
 * Layouts, resize borders and Win11 rounded corners). The frame is painted dark
 * via `nativeTheme.themeSource = 'dark'` (set once at startup) to match the app.
 * The transparent React overlay layered on top (see {@link createOverlayWindow})
 * is glued to this window's *content* area, so it sits below the native title bar
 * rather than replacing it. Two independent top-level windows composite reliably
 * via DWM, unlike a native child window inside a transparent web view.
 */
export function createVideoWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 840,
    minHeight: 520,
    show: false,
    backgroundColor: '#000000',
    title: 'FramePlayer',
    autoHideMenuBar: true,
    webPreferences: {
      // No preload / IPC here — this window is a passive video host.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.once('ready-to-show', () => window.show())

  // A blank black page; the embedded mpv window (raised above it) draws the video.
  void window.loadURL('data:text/html,<body style="margin:0;background:%23000"></body>')

  return window
}
