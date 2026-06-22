import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { UpdateService } from '../update/UpdateService'
import { broadcast } from './broadcast'

/**
 * Bridges the {@link UpdateService} to the renderers: manual check / install,
 * the current app version, and a broadcast of every status change so all windows
 * (overlay + pop-out) reflect the same update phase.
 *
 * @returns a disposer that removes the handlers and subscription.
 */
export function registerUpdateBridge(service: UpdateService): () => void {
  ipcMain.handle(IpcChannels.checkForUpdates, () => service.checkNow())
  ipcMain.handle(IpcChannels.appVersion, () => service.getVersion())
  ipcMain.on(IpcChannels.installUpdate, () => service.quitAndInstall())

  const unsubscribe = service.subscribe((status) =>
    broadcast(IpcChannels.updateStatusChanged, status)
  )

  return () => {
    ipcMain.removeHandler(IpcChannels.checkForUpdates)
    ipcMain.removeHandler(IpcChannels.appVersion)
    ipcMain.removeAllListeners(IpcChannels.installUpdate)
    unsubscribe()
  }
}
