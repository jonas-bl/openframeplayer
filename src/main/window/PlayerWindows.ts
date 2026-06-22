import type { BrowserWindow } from 'electron'
import { createVideoWindow } from './createVideoWindow'
import { createOverlayWindow } from './createOverlayWindow'
import { createControlsPopout } from './createControlsPopout'

/**
 * Creates and manages the windows that make embedded mpv work:
 *   - `video`   : opaque bottom window hosting mpv (via its native handle)
 *   - `overlay` : transparent top window hosting the React UI
 *   - an optional pop-out controls window (created on demand)
 *
 * The overlay is glued to the video window's content area through move/resize/
 * restore/fullscreen events, so the two read as a single window. Lifecycle is
 * linked too — minimizing/closing the video window hides/closes the overlay.
 */
export class PlayerWindows {
  readonly video: BrowserWindow
  readonly overlay: BrowserWindow
  private popout: BrowserWindow | null = null

  /**
   * @param onPopoutChanged notified (instance-scoped) when the pop-out opens/closes.
   * @param onPopoutCreated notified with the freshly created pop-out window, so
   *   the owner can wire its window-control events.
   */
  constructor(
    private readonly onPopoutChanged: (open: boolean) => void = () => {},
    private readonly onPopoutCreated: (popout: BrowserWindow) => void = () => {}
  ) {
    this.video = createVideoWindow()
    this.overlay = createOverlayWindow(this.video)
    this.linkWindows()
  }

  /** Live renderer webContents belonging to this window group (overlay + popout). */
  get rendererWebContents(): Electron.WebContents[] {
    // Guard the overlay too: teardown can emit (e.g. a proxy 'off' status fired
    // from dispose) after the window is destroyed, and reading `.webContents`
    // off a destroyed BrowserWindow throws "Object has been destroyed".
    const list: Electron.WebContents[] = []
    if (!this.overlay.isDestroyed()) list.push(this.overlay.webContents)
    if (this.popout && !this.popout.isDestroyed()) list.push(this.popout.webContents)
    return list
  }

  private linkWindows(): void {
    const sync = (): void => this.syncOverlayBounds()

    this.video.on('move', sync)
    this.video.on('resize', sync)
    this.video.on('enter-full-screen', sync)
    this.video.on('leave-full-screen', sync)
    this.video.on('restore', () => {
      this.overlay.show()
      sync()
    })
    this.video.on('minimize', () => this.overlay.hide())

    this.video.on('show', () => {
      sync()
      this.overlay.show()
    })

    this.video.on('closed', () => {
      if (!this.overlay.isDestroyed()) this.overlay.close()
      this.closeControlsPopout()
    })
  }

  /** Positions the overlay exactly over the video window's content area. */
  private syncOverlayBounds(): void {
    if (this.video.isDestroyed() || this.overlay.isDestroyed()) return
    this.overlay.setBounds(this.video.getContentBounds())
  }

  /** Opens (or focuses) the pop-out controls window. */
  openControlsPopout(): void {
    if (this.popout && !this.popout.isDestroyed()) {
      this.popout.focus()
      return
    }
    this.popout = createControlsPopout()
    this.onPopoutCreated(this.popout)
    this.popout.on('closed', () => {
      this.popout = null
      this.onPopoutChanged(false)
    })
    this.onPopoutChanged(true)
  }

  closeControlsPopout(): void {
    if (this.popout && !this.popout.isDestroyed()) this.popout.close()
    this.popout = null
  }

  setControlsPopout(open: boolean): void {
    if (open) this.openControlsPopout()
    else this.closeControlsPopout()
  }

  /** Closes all windows. */
  dispose(): void {
    this.closeControlsPopout()
    if (!this.overlay.isDestroyed()) this.overlay.destroy()
    if (!this.video.isDestroyed()) this.video.destroy()
  }
}
