import { app } from 'electron'
import log from 'electron-log/main'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '@shared/update'

// electron-updater is CommonJS; destructure after a default import so this works
// regardless of how the bundler interops the module.
const { autoUpdater } = electronUpdater

/** How often the running app re-checks GitHub Releases for a newer version. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
/** Delay the first check so it never competes with window/mpv startup. */
const FIRST_CHECK_DELAY_MS = 10_000

/**
 * Owns the self-update lifecycle via electron-updater.
 *
 * The app downloads updates silently in the background and surfaces progress to
 * the renderer as a flat {@link UpdateStatus}; the user only has to click
 * "Restart" once an update is staged (or it installs on the next quit). The feed
 * is the GitHub Release configured under `publish:` in electron-builder.yml.
 *
 * Updates are inert unless the app is packaged — in dev there is no
 * `app-update.yml`, so electron-updater would only throw. We keep the service
 * constructible there (so the IPC bridge and UI work) but it just reports `idle`.
 */
export class UpdateService {
  private status: UpdateStatus = { state: 'idle' }
  private readonly listeners = new Set<(status: UpdateStatus) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private firstCheck: ReturnType<typeof setTimeout> | null = null
  /** Version from the most recent `update-available`, reused for progress events. */
  private pendingVersion = ''

  constructor() {
    if (!app.isPackaged) return

    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => this.emit({ state: 'checking' }))
    autoUpdater.on('update-available', (info) => {
      this.pendingVersion = info.version
      this.emit({ state: 'available', version: info.version })
    })
    autoUpdater.on('update-not-available', () => this.emit({ state: 'up-to-date' }))
    autoUpdater.on('download-progress', (progress) =>
      this.emit({
        state: 'downloading',
        version: this.pendingVersion,
        percent: Math.round(progress.percent)
      })
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.emit({ state: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (err) => this.emit({ state: 'error', message: messageOf(err) }))

    this.timer = setInterval(() => void this.checkNow(), CHECK_INTERVAL_MS)
    this.firstCheck = setTimeout(() => void this.checkNow(), FIRST_CHECK_DELAY_MS)
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  getVersion(): string {
    return app.getVersion()
  }

  /** Check the release feed now. Silently does nothing when unpackaged. */
  async checkNow(): Promise<void> {
    if (!app.isPackaged) return
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      // checkForUpdates rejects when offline / the feed is unreachable; the
      // 'error' event usually fires too, but emit here so a reject never escapes.
      this.emit({ state: 'error', message: messageOf(err) })
    }
  }

  /** Quit and install the staged update. No-op unless one is downloaded. */
  quitAndInstall(): void {
    if (this.status.state !== 'downloaded') return
    autoUpdater.quitAndInstall()
  }

  /** Subscribe to status changes; returns an unsubscribe function. */
  subscribe(listener: (status: UpdateStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer)
    if (this.firstCheck) clearTimeout(this.firstCheck)
    this.timer = null
    this.firstCheck = null
    this.listeners.clear()
    autoUpdater.removeAllListeners()
  }

  private emit(status: UpdateStatus): void {
    this.status = status
    for (const listener of this.listeners) listener(status)
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
