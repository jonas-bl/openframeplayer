import { BrowserWindow } from 'electron'
import { PRELOAD_PATH, rendererTarget } from './preloadPath'

/**
 * An always-on-top window that hosts ALL controls (transport + image panel)
 * when popped out; the player window then shows none.
 *
 * Loads the same renderer with `?view=controls`, so it shares the player store
 * over IPC and stays in sync. Handy alongside fullscreen, where the in-window
 * chrome is hidden. Unlike the main overlay this is a normal opaque window, so
 * it can be dragged natively via an app-region region in the controls view.
 */
export function createControlsPopout(): BrowserWindow {
  const window = new BrowserWindow({
    width: 560,
    height: 360,
    minWidth: 320,
    minHeight: 180,
    show: false,
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    // A real window of its own: it lives in the taskbar and has min/max/close
    // controls. Still kept above the player so it stays usable over fullscreen.
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#141417',
    title: 'FramePlayer Controls',
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.once('ready-to-show', () => window.show())

  // Keep the page zoom locked (Ctrl+wheel is reserved for playback speed).
  window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  window.webContents.on('zoom-changed', () => window.webContents.setZoomFactor(1))

  const target = rendererTarget('controls')
  if (target.url) void window.loadURL(target.url)
  else void window.loadFile(target.file!, { search: target.search })

  return window
}
