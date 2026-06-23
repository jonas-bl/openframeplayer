import { BrowserWindow, shell } from 'electron'
import { PRELOAD_PATH, rendererTarget } from './preloadPath'
import { enableRoundedCorners } from '../embedding/win32'
import { getWindowId } from '../embedding/windowHandle'

/**
 * The top "overlay" window: transparent, frameless, and a child of the video
 * window. It hosts the entire React UI. Transparent regions reveal the mpv
 * video beneath; opaque regions (controls, panels) draw over it.
 *
 * It captures all pointer input — including drag-to-pan/zoom over the video —
 * and forwards semantic actions to the main process through the preload bridge.
 *
 * @param parent - the video window this overlay is glued on top of.
 * @param opts.launchedWithFile - true when this window opened straight into a
 *   media file (e.g. "Open with FramePlayer"); the renderer reads this to skip
 *   the animated start screen so playback isn't delayed.
 */
export function createOverlayWindow(
  parent: BrowserWindow,
  opts: { launchedWithFile?: boolean } = {}
): BrowserWindow {
  const window = new BrowserWindow({
    parent,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: PRELOAD_PATH,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Open external links in the OS browser, never in-app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Lock the page zoom: the UI uses Ctrl+wheel for playback speed, so Chromium's
  // own pinch/Ctrl+wheel zoom must never resize the chrome.
  window.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  window.webContents.on('zoom-changed', () => window.webContents.setZoomFactor(1))

  // The overlay is the topmost window, so its corners are what the user sees;
  // ask DWM to round them to match Win11 (the opaque video window beneath
  // already rounds, but this square overlay covers it).
  enableRoundedCorners(getWindowId(window))

  const target = rendererTarget(undefined, opts.launchedWithFile ? { launchedWithFile: '1' } : {})
  if (target.url) void window.loadURL(target.url)
  else void window.loadFile(target.file!, target.search ? { search: target.search } : undefined)

  return window
}
