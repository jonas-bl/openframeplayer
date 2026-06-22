import type { BrowserWindow } from 'electron'
import type { VideoBounds } from '@shared/ipc'
import { getWindowId } from './windowHandle'
import { findChildWindowByClass, raiseWindowToTop, placeWindowOnTop } from './win32'

/** mpv's child window class name on Windows. */
const MPV_WINDOW_CLASS = 'mpv'

/**
 * Keeps the embedded mpv video window raised above the host window's Chromium
 * surface and confined to the on-screen region the renderer reports (so the
 * title bar / transport bar never cover the video).
 *
 * mpv creates its child window only once a video output initialises (after the
 * first file loads), and Chromium can re-assert its z-order on resize, so this
 * re-applies the raise (and position) at the moments that matter: an initial
 * poll, on demand (file load / window resize), and whenever bounds change.
 */
export class MpvEmbedder {
  private readonly hostHwnd: bigint
  private pollTimer: NodeJS.Timeout | null = null
  private bounds: VideoBounds | null = null

  constructor(private readonly hostWindow: BrowserWindow) {
    this.hostHwnd = getWindowId(hostWindow)
    this.hostWindow.on('resize', () => this.raiseNow())
    this.hostWindow.on('restore', () => this.raiseNow())
  }

  /** Sets the video region (physical px) and applies it immediately if able. */
  setBounds(bounds: VideoBounds): void {
    this.bounds = bounds
    this.raiseNow()
  }

  /** Raises (and positions) mpv now if its window exists yet. */
  raiseNow(): boolean {
    const mpv = findChildWindowByClass(this.hostHwnd, MPV_WINDOW_CLASS)
    if (!mpv) return false
    if (this.bounds) {
      placeWindowOnTop(mpv, this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height)
    } else {
      raiseWindowToTop(mpv)
    }
    return true
  }

  /**
   * Polls until the mpv window appears and is raised, or the timeout elapses.
   * Called after the engine is ready so the video shows as soon as mpv creates
   * its output window.
   */
  pollUntilRaised(timeoutMs = 8000, intervalMs = 250): void {
    this.stopPolling()
    const deadline = Date.now() + timeoutMs
    this.pollTimer = setInterval(() => {
      if (this.raiseNow() || Date.now() >= deadline) this.stopPolling()
    }, intervalMs)
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  dispose(): void {
    this.stopPolling()
  }
}
