import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { AppSettings } from '@shared/settings'
import type { SettingsStore } from '../settings/SettingsStore'
import { broadcast } from './broadcast'

/**
 * Bridges the persisted {@link SettingsStore} to the renderers: read, update,
 * and broadcast changes so every window (overlay + pop-out) stays in sync.
 *
 * @returns a disposer that removes the handlers and subscription.
 */
export function registerSettingsBridge(store: SettingsStore): () => void {
  ipcMain.handle(IpcChannels.getSettings, () => store.getSettings())
  ipcMain.handle(IpcChannels.updateSettings, (_e, patch: Partial<AppSettings>) =>
    store.update(patch)
  )

  const unsubscribe = store.subscribe((settings) =>
    broadcast(IpcChannels.settingsChanged, settings)
  )

  return () => {
    ipcMain.removeHandler(IpcChannels.getSettings)
    ipcMain.removeHandler(IpcChannels.updateSettings)
    unsubscribe()
  }
}
