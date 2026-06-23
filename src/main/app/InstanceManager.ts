import { app, type WebContents } from 'electron'
import type { SettingsStore } from '../settings/SettingsStore'
import type { PlayerAction } from '@shared/player-actions'
import { PlayerInstance } from './PlayerInstance'

/**
 * Owns every open {@link PlayerInstance}. Each call to {@link createInstance}
 * opens an independent player window (its own mpv engine), so multiple videos
 * can play at once. The app quits when the last window closes.
 */
export class InstanceManager {
  private readonly instances = new Set<PlayerInstance>()

  constructor(private readonly settings: SettingsStore) {}

  async createInstance(initialFile?: string | null): Promise<PlayerInstance> {
    const instance = await PlayerInstance.create(this.settings, initialFile)
    this.instances.add(instance)
    // Linked windows mirror transport to one another (comparison feature).
    instance.setMirror((action) => this.fanOutMirrored(instance, action))

    instance.windows.video.on('closed', () => {
      instance.dispose()
      this.instances.delete(instance)
      if (this.instances.size === 0 && process.platform !== 'darwin') app.quit()
    })

    return instance
  }

  /** Sets a window's transport-link state (comparison). */
  setComparisonLink(instance: PlayerInstance, linked: boolean): void {
    instance.setComparisonLink(linked)
  }

  /**
   * Forwards a mirrored transport action from `source` to every *other* linked
   * window. `applyMirrored` dispatches without re-mirroring, so there's no echo.
   */
  private fanOutMirrored(source: PlayerInstance, action: PlayerAction): void {
    for (const instance of this.instances) {
      if (instance !== source && instance.isComparisonLinked) instance.applyMirrored(action)
    }
  }

  /** Resolves the instance that owns the renderer behind an IPC message. */
  forSender(sender: WebContents): PlayerInstance | undefined {
    for (const instance of this.instances) {
      if (instance.ownsWebContents(sender)) return instance
    }
    return undefined
  }

  get count(): number {
    return this.instances.size
  }

  disposeAll(): void {
    for (const instance of this.instances) instance.dispose()
    this.instances.clear()
  }
}
