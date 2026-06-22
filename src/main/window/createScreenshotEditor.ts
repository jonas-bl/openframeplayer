import { BrowserWindow } from 'electron'
import { PRELOAD_PATH, rendererTarget } from './preloadPath'

/**
 * A standalone window for editing a freshly captured screenshot: adjust
 * saturation/brightness/contrast/hue, draw annotations, zoom/pan, then save.
 *
 * Loads the same renderer with `?view=editor`. Unlike the transparent player
 * overlay this is a normal opaque, frameless, resizable window that lives in the
 * taskbar — each capture opens its own. The image it edits is pulled from main
 * via the `getEditorPayload` IPC once the page is ready.
 */
export function createScreenshotEditor(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1040,
    height: 760,
    minWidth: 720,
    minHeight: 520,
    show: false,
    frame: false,
    resizable: true,
    backgroundColor: '#0f0f12',
    title: 'Edit screenshot',
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  window.once('ready-to-show', () => window.show())

  // Keep the page zoom locked (Ctrl+wheel is used for editor zoom, not page zoom).
  window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  window.webContents.on('zoom-changed', () => window.webContents.setZoomFactor(1))

  const target = rendererTarget('editor')
  if (target.url) void window.loadURL(target.url)
  else void window.loadFile(target.file!, { search: target.search })

  return window
}
