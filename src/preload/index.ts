import { contextBridge, ipcRenderer } from 'electron'
import {
  IpcChannels,
  WindowChannels,
  type EditorPayload,
  type PlayerApi,
  type SaveScreenshotOptions,
  type UpscaleBackend,
  type UpscaleTile,
  type VideoBounds,
  type WindowControlsApi,
  type WindowEdge,
  type ScreenPoint,
  type ResumePayload,
  type ThumbnailSheet,
  type ExportRequest,
  type ExportStatus
} from '@shared/ipc'
import type { FileMetadata, Marker, RecentFile } from '@shared/fileMetadata'
import type { PlayerAction } from '@shared/player-actions'
import type { PlayerState } from '@shared/player-state'
import type { AppSettings } from '@shared/settings'
import type { AnnotationControl } from '@shared/annotation'
import type { UpscaleModelId, UpscaleModelStatus, UpscaleProgress } from '@shared/upscale'
import type { ImageGenRequest, ImageGenResult } from '@shared/imageGen'
import type { UpdateStatus } from '@shared/update'

/**
 * The preload bridge: the sole, sandboxed surface the renderer is allowed to
 * touch. It exposes a typed {@link PlayerApi} and forwards everything to the
 * main process over named IPC channels. No mpv knowledge leaks across here —
 * only semantic actions and state.
 */
const api: PlayerApi = {
  dispatch(action: PlayerAction): Promise<void> {
    return ipcRenderer.invoke(IpcChannels.dispatch, action)
  },

  openFile(): Promise<string | null> {
    return ipcRenderer.invoke(IpcChannels.openFile)
  },

  getState(): Promise<PlayerState> {
    return ipcRenderer.invoke(IpcChannels.getState)
  },

  onStateChanged(callback: (state: PlayerState) => void): () => void {
    const listener = (_event: unknown, state: PlayerState): void => callback(state)
    ipcRenderer.on(IpcChannels.stateChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.stateChanged, listener)
  },

  onScreenshotSaved(callback: (filePath: string) => void): () => void {
    const listener = (_event: unknown, filePath: string): void => callback(filePath)
    ipcRenderer.on(IpcChannels.screenshotSaved, listener)
    return () => ipcRenderer.removeListener(IpcChannels.screenshotSaved, listener)
  },

  getSettings(): Promise<AppSettings> {
    return ipcRenderer.invoke(IpcChannels.getSettings)
  },

  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    return ipcRenderer.invoke(IpcChannels.updateSettings, patch)
  },

  onSettingsChanged(callback: (settings: AppSettings) => void): () => void {
    const listener = (_event: unknown, settings: AppSettings): void => callback(settings)
    ipcRenderer.on(IpcChannels.settingsChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.settingsChanged, listener)
  },

  getAnnotationControl(): Promise<AnnotationControl> {
    return ipcRenderer.invoke(IpcChannels.getAnnotationControl)
  },

  setAnnotationControl(patch: Partial<AnnotationControl>): void {
    ipcRenderer.send(IpcChannels.setAnnotationControl, patch)
  },

  onAnnotationControlChanged(callback: (patch: Partial<AnnotationControl>) => void): () => void {
    const listener = (_event: unknown, patch: Partial<AnnotationControl>): void => callback(patch)
    ipcRenderer.on(IpcChannels.annotationControlChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.annotationControlChanged, listener)
  },

  setControlsPopout(open: boolean): void {
    ipcRenderer.send(IpcChannels.setControlsPopout, open)
  },

  onPopoutChanged(callback: (open: boolean) => void): () => void {
    const listener = (_event: unknown, open: boolean): void => callback(open)
    ipcRenderer.on(IpcChannels.popoutChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.popoutChanged, listener)
  },

  setPanelPopout(open: boolean): void {
    ipcRenderer.send(IpcChannels.setPanelPopout, open)
  },

  onPanelPopoutChanged(callback: (open: boolean) => void): () => void {
    const listener = (_event: unknown, open: boolean): void => callback(open)
    ipcRenderer.on(IpcChannels.panelPopoutChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.panelPopoutChanged, listener)
  },

  setVideoBounds(bounds: VideoBounds): void {
    ipcRenderer.send(IpcChannels.setVideoBounds, bounds)
  },

  captureFrame(maxWidth?: number) {
    return ipcRenderer.invoke(IpcChannels.captureFrame, maxWidth)
  },

  openScreenshotEditor(): void {
    ipcRenderer.send(IpcChannels.openScreenshotEditor)
  },

  getScreenshotEditorPayload(): Promise<EditorPayload | null> {
    return ipcRenderer.invoke(IpcChannels.getEditorPayload)
  },

  saveScreenshot(bytes: Uint8Array, opts: SaveScreenshotOptions): Promise<string | null> {
    return ipcRenderer.invoke(IpcChannels.saveScreenshot, bytes, opts)
  },

  closeScreenshotEditor(): void {
    ipcRenderer.send(IpcChannels.closeEditor)
  },

  newWindow(): void {
    ipcRenderer.send(IpcChannels.newWindow)
  },

  chooseDirectory(): Promise<string | null> {
    return ipcRenderer.invoke(IpcChannels.chooseDirectory)
  },

  upscaleModelStatus(): Promise<UpscaleModelStatus> {
    return ipcRenderer.invoke(IpcChannels.upscaleModelStatus)
  },

  loadUpscaleModel(id: UpscaleModelId): Promise<{ backend: UpscaleBackend }> {
    return ipcRenderer.invoke(IpcChannels.loadUpscaleModel, id)
  },

  upscaleTile(id: UpscaleModelId, tile: UpscaleTile): Promise<UpscaleTile> {
    return ipcRenderer.invoke(IpcChannels.upscaleTile, id, tile)
  },

  removeUpscaleModel(id: UpscaleModelId): Promise<boolean> {
    return ipcRenderer.invoke(IpcChannels.removeUpscaleModel, id)
  },

  onUpscaleProgress(callback: (progress: UpscaleProgress) => void): () => void {
    const listener = (_event: unknown, progress: UpscaleProgress): void => callback(progress)
    ipcRenderer.on(IpcChannels.upscaleProgress, listener)
    return () => ipcRenderer.removeListener(IpcChannels.upscaleProgress, listener)
  },

  generateImage(request: ImageGenRequest): Promise<ImageGenResult> {
    return ipcRenderer.invoke(IpcChannels.generateImage, request)
  },

  checkForUpdates(): Promise<void> {
    return ipcRenderer.invoke(IpcChannels.checkForUpdates)
  },

  installUpdate(): void {
    ipcRenderer.send(IpcChannels.installUpdate)
  },

  onUpdateStatusChanged(callback: (status: UpdateStatus) => void): () => void {
    const listener = (_event: unknown, status: UpdateStatus): void => callback(status)
    ipcRenderer.on(IpcChannels.updateStatusChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.updateStatusChanged, listener)
  },

  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke(IpcChannels.appVersion)
  },

  getFileMetadata(path: string): Promise<FileMetadata | null> {
    return ipcRenderer.invoke(IpcChannels.getFileMetadata, path)
  },

  saveResume(payload: ResumePayload): void {
    ipcRenderer.send(IpcChannels.saveResume, payload)
  },

  saveBookmarks(path: string, bookmarks: Marker[]): void {
    ipcRenderer.send(IpcChannels.saveBookmarks, path, bookmarks)
  },

  getRecentFiles(): Promise<RecentFile[]> {
    return ipcRenderer.invoke(IpcChannels.getRecentFiles)
  },

  getThumbnailSheet(path: string, duration: number): Promise<ThumbnailSheet | null> {
    return ipcRenderer.invoke(IpcChannels.getThumbnailSheet, path, duration)
  },

  exportRange(request: ExportRequest): Promise<string | null> {
    return ipcRenderer.invoke(IpcChannels.exportRange, request)
  },

  onExportStatusChanged(callback: (status: ExportStatus) => void): () => void {
    const listener = (_event: unknown, status: ExportStatus): void => callback(status)
    ipcRenderer.on(IpcChannels.exportStatusChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.exportStatusChanged, listener)
  },

  setComparisonLink(linked: boolean): void {
    ipcRenderer.send(IpcChannels.setComparisonLink, linked)
  },

  onComparisonLinkChanged(callback: (linked: boolean) => void): () => void {
    const listener = (_event: unknown, linked: boolean): void => callback(linked)
    ipcRenderer.on(IpcChannels.comparisonLinkChanged, listener)
    return () => ipcRenderer.removeListener(IpcChannels.comparisonLinkChanged, listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

/** Custom (frameless) window controls, exposed separately on window.windowControls. */
const windowControls: WindowControlsApi = {
  minimize: () => ipcRenderer.send(WindowChannels.minimize),
  toggleMaximize: () => ipcRenderer.send(WindowChannels.toggleMaximize),
  close: () => ipcRenderer.send(WindowChannels.close),
  isMaximized: () => ipcRenderer.invoke(WindowChannels.isMaximized),
  onMaximizedChanged(callback: (maximized: boolean) => void): () => void {
    const listener = (_e: unknown, maximized: boolean): void => callback(maximized)
    ipcRenderer.on(WindowChannels.maximizedChanged, listener)
    return () => ipcRenderer.removeListener(WindowChannels.maximizedChanged, listener)
  },
  toggleFullscreen: () => ipcRenderer.send(WindowChannels.toggleFullscreen),
  isFullscreen: () => ipcRenderer.invoke(WindowChannels.isFullscreen),
  onFullscreenChanged(callback: (fullscreen: boolean) => void): () => void {
    const listener = (_e: unknown, fullscreen: boolean): void => callback(fullscreen)
    ipcRenderer.on(WindowChannels.fullscreenChanged, listener)
    return () => ipcRenderer.removeListener(WindowChannels.fullscreenChanged, listener)
  },
  toggleAlwaysOnTop: () => ipcRenderer.send(WindowChannels.toggleAlwaysOnTop),
  isAlwaysOnTop: () => ipcRenderer.invoke(WindowChannels.isAlwaysOnTop),
  onAlwaysOnTopChanged(callback: (onTop: boolean) => void): () => void {
    const listener = (_e: unknown, onTop: boolean): void => callback(onTop)
    ipcRenderer.on(WindowChannels.alwaysOnTopChanged, listener)
    return () => ipcRenderer.removeListener(WindowChannels.alwaysOnTopChanged, listener)
  },
  moveStart: (point: ScreenPoint) => ipcRenderer.send(WindowChannels.moveStart, point),
  move: (point: ScreenPoint) => ipcRenderer.send(WindowChannels.move, point),
  resizeStart: (edge: WindowEdge, point: ScreenPoint) =>
    ipcRenderer.send(WindowChannels.resizeStart, edge, point),
  resize: (point: ScreenPoint) => ipcRenderer.send(WindowChannels.resize, point)
}

contextBridge.exposeInMainWorld('windowControls', windowControls)
