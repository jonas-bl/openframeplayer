import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { mergeSettings, type AppSettings } from '@shared/settings'

type Listener = (settings: AppSettings) => void

/**
 * Loads, persists and broadcasts {@link AppSettings} as JSON on disk.
 *
 * Reads are tolerant: a missing or corrupt file falls back to defaults, and
 * partial files are merged over defaults (so new settings appear automatically
 * on upgrade). Writes are best-effort and never throw into the caller.
 */
export class SettingsStore {
  private settings: AppSettings
  private readonly listeners = new Set<Listener>()

  constructor(private readonly filePath: string) {
    this.settings = this.load()
  }

  getSettings(): AppSettings {
    return this.settings
  }

  /** Merges a patch, persists, and notifies listeners. Returns the result. */
  update(patch: Partial<AppSettings>): AppSettings {
    this.settings = mergeSettings({ ...this.settings, ...patch })
    this.save()
    for (const listener of this.listeners) listener(this.settings)
    return this.settings
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private load(): AppSettings {
    try {
      return mergeSettings(JSON.parse(readFileSync(this.filePath, 'utf8')))
    } catch {
      return mergeSettings(null)
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf8')
    } catch {
      /* best-effort; settings simply won't persist this session */
    }
  }
}
