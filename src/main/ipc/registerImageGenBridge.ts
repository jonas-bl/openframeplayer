import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipc'
import type { ImageGenRequest } from '@shared/imageGen'
import type { ImageGenService } from '../imagegen/ImageGenService'

/**
 * Bridges the {@link ImageGenService} to the renderer: a single invoke that runs
 * the requested AI image op and resolves with the result bytes (or rejects with
 * a human-readable message the editor surfaces inline).
 *
 * @returns a disposer that removes the handler.
 */
export function registerImageGenBridge(service: ImageGenService): () => void {
  ipcMain.handle(IpcChannels.generateImage, (_event, request: ImageGenRequest) =>
    service.generate(request)
  )

  return () => {
    ipcMain.removeHandler(IpcChannels.generateImage)
  }
}
