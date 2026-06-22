import { ipcMain } from 'electron'
import { IpcChannels, type UpscaleTile } from '@shared/ipc'
import type { UpscaleModelId, UpscaleProgress } from '@shared/upscale'
import type { UpscaleService } from '../upscale/UpscaleService'

/**
 * Bridges the {@link UpscaleService} to the renderers: query installed models,
 * load (downloading if needed) a model's GPU/CPU session, run one tile of
 * super-resolution, and remove a cached model. Download progress is pushed back
 * to the requesting window only.
 *
 * @returns a disposer that removes the handlers.
 */
export function registerUpscaleBridge(service: UpscaleService): () => void {
  ipcMain.handle(IpcChannels.upscaleModelStatus, () => service.status())

  ipcMain.handle(IpcChannels.loadUpscaleModel, (event, id: UpscaleModelId) =>
    service.load(id, (received, total) => {
      if (event.sender.isDestroyed()) return
      const progress: UpscaleProgress = { id, received, total }
      event.sender.send(IpcChannels.upscaleProgress, progress)
    })
  )

  ipcMain.handle(IpcChannels.upscaleTile, (_event, id: UpscaleModelId, tile: UpscaleTile) =>
    service.tile(id, tile)
  )

  ipcMain.handle(IpcChannels.removeUpscaleModel, (_event, id: UpscaleModelId) => service.remove(id))

  return () => {
    ipcMain.removeHandler(IpcChannels.upscaleModelStatus)
    ipcMain.removeHandler(IpcChannels.loadUpscaleModel)
    ipcMain.removeHandler(IpcChannels.upscaleTile)
    ipcMain.removeHandler(IpcChannels.removeUpscaleModel)
  }
}
