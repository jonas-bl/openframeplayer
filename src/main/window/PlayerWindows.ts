import type { BrowserWindow } from 'electron'
import { createVideoWindow } from './createVideoWindow'
import { createOverlayWindow } from './createOverlayWindow'
import { createControlsPopout } from './createControlsPopout'
import { createPanelPopout } from './createPanelPopout'

/** The kinds of detachable pop-out window a player group can have. */
export type PopoutKind = 'controls' | 'panels'

const POPOUT_FACTORIES: Record<PopoutKind, () => BrowserWindow> = {
  controls: createControlsPopout,
  panels: createPanelPopout
}

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
  private readonly popouts: Record<PopoutKind, BrowserWindow | null> = {
    controls: null,
    panels: null
  }

  /**
   * @param onPopoutChanged notified (instance-scoped) when a pop-out opens/closes.
   * @param onPopoutCreated notified with the freshly created pop-out window, so
   *   the owner can wire its window-control events.
   * @param launchedWithFile true when the window opened straight into a media
   *   file; forwarded to the overlay so the renderer skips the start screen.
   */
  constructor(
    private readonly onPopoutChanged: (kind: PopoutKind, open: boolean) => void = () => {},
    private readonly onPopoutCreated: (popout: BrowserWindow) => void = () => {},
    launchedWithFile = false
  ) {
    this.video = createVideoWindow()
    this.overlay = createOverlayWindow(this.video, { launchedWithFile })
    this.linkWindows()
  }

  /** Live renderer webContents belonging to this window group (overlay + pop-outs). */
  get rendererWebContents(): Electron.WebContents[] {
    // Guard the overlay too: teardown can emit (e.g. a proxy 'off' status fired
    // from dispose) after the window is destroyed, and reading `.webContents`
    // off a destroyed BrowserWindow throws "Object has been destroyed".
    const list: Electron.WebContents[] = []
    if (!this.overlay.isDestroyed()) list.push(this.overlay.webContents)
    for (const popout of Object.values(this.popouts)) {
      if (popout && !popout.isDestroyed()) list.push(popout.webContents)
    }
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
      this.closeAllPopouts()
    })
  }

  /** Positions the overlay exactly over the video window's content area. */
  private syncOverlayBounds(): void {
    if (this.video.isDestroyed() || this.overlay.isDestroyed()) return
    this.overlay.setBounds(this.video.getContentBounds())
  }

  /** Opens (or focuses) a pop-out window of the given kind. */
  private openPopout(kind: PopoutKind): void {
    const existing = this.popouts[kind]
    if (existing && !existing.isDestroyed()) {
      existing.focus()
      return
    }
    const popout = POPOUT_FACTORIES[kind]()
    this.popouts[kind] = popout
    this.onPopoutCreated(popout)
    popout.on('closed', () => {
      this.popouts[kind] = null
      this.onPopoutChanged(kind, false)
    })
    this.onPopoutChanged(kind, true)
  }

  private closePopout(kind: PopoutKind): void {
    const popout = this.popouts[kind]
    if (popout && !popout.isDestroyed()) popout.close()
    this.popouts[kind] = null
  }

  private closeAllPopouts(): void {
    for (const kind of Object.keys(this.popouts) as PopoutKind[]) this.closePopout(kind)
  }

  /** Opens/closes a pop-out window of the given kind. */
  setPopout(kind: PopoutKind, open: boolean): void {
    if (open) this.openPopout(kind)
    else this.closePopout(kind)
  }

  /** Closes all windows. */
  dispose(): void {
    this.closeAllPopouts()
    if (!this.overlay.isDestroyed()) this.overlay.destroy()
    if (!this.video.isDestroyed()) this.video.destroy()
  }
}
