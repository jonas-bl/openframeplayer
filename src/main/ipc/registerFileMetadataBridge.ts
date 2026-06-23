import { ipcMain } from 'electron'
import { IpcChannels, type ResumePayload } from '@shared/ipc'
import type { Marker } from '@shared/fileMetadata'
import type { FileMetadataStore } from '../persist/FileMetadataStore'

/**
 * Bridges the per-file {@link FileMetadataStore} to the renderers: read a file's
 * metadata, record resume positions / bookmarks, and list recent files. The
 * store is app-global (shared across all player windows), so these handlers are
 * registered once and not routed per-instance.
 *
 * @returns a disposer that removes the handlers.
 */
export function registerFileMetadataBridge(store: FileMetadataStore): () => void {
  ipcMain.handle(IpcChannels.getFileMetadata, (_e, path: string) => store.get(path))
  ipcMain.handle(IpcChannels.getRecentFiles, () => store.recents())
  ipcMain.on(IpcChannels.saveResume, (_e, p: ResumePayload) =>
    store.saveResume(p.path, p.pos, p.duration)
  )
  ipcMain.on(IpcChannels.saveBookmarks, (_e, path: string, bookmarks: Marker[]) =>
    store.setBookmarks(path, bookmarks)
  )

  return () => {
    ipcMain.removeHandler(IpcChannels.getFileMetadata)
    ipcMain.removeHandler(IpcChannels.getRecentFiles)
    ipcMain.removeAllListeners(IpcChannels.saveResume)
    ipcMain.removeAllListeners(IpcChannels.saveBookmarks)
  }
}
