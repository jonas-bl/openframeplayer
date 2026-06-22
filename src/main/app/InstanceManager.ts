import { app, type WebContents } from 'electron'
import type { SettingsStore } from '../settings/SettingsStore'
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

    instance.windows.video.on('closed', () => {
      instance.dispose()
      this.instances.delete(instance)
      if (this.instances.size === 0 && process.platform !== 'darwin') app.quit()
    })

    return instance
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
