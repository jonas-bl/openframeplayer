import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { ThumbnailService } from '../thumbnails/ThumbnailService'

/**
 * Bridges the app-global {@link ThumbnailService} to the renderers: build/fetch
 * the seek-bar thumbnail sheet for a file. Registered once.
 *
 * @returns a disposer that removes the handler.
 */
export function registerThumbnailBridge(service: ThumbnailService): () => void {
  ipcMain.handle(IpcChannels.getThumbnailSheet, (_e, path: string, duration: number) =>
    service.get(path, duration)
  )
  return () => ipcMain.removeHandler(IpcChannels.getThumbnailSheet)
}
