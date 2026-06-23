import { BrowserWindow } from 'electron'
import { PRELOAD_PATH, rendererTarget } from './preloadPath'

/**
 * An always-on-top window that hosts the detached Pro analysis-panel dock
 * (scopes, guides, frame-diff controls). Loads the same renderer with
 * `?view=panels`, so it shares the player state + settings over IPC and stays
 * in sync with the main window. Meant to be dragged onto a second monitor.
 */
export function createPanelPopout(): BrowserWindow {
  const window = new BrowserWindow({
    width: 420,
    height: 640,
    minWidth: 300,
    minHeight: 240,
    show: false,
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#141417',
    title: 'FramePlayer Panels',
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  window.webContents.on('zoom-changed', () => window.webContents.setZoomFactor(1))

  const target = rendererTarget('panels')
  if (target.url) void window.loadURL(target.url)
  else void window.loadFile(target.file!, { search: target.search })

  return window
}
