import type { PlayerAction } from './player-actions'
import type { PlayerState } from './player-state'
import type { AppSettings } from './settings'
import type { AnnotationControl } from './annotation'
import type { UpscaleModelId, UpscaleModelStatus, UpscaleProgress } from './upscale'
import type { ImageGenRequest, ImageGenResult } from './imageGen'
import type { UpdateStatus } from './update'
import type { FileMetadata, Marker, RecentFile } from './fileMetadata'

/**
 * The IPC contract between the renderer and the main process.
 *
 * Channel names live here as constants so both sides import the exact same
 * string — no stray magic strings, no typos that only fail at runtime.
 */
export const IpcChannels = {
  /** renderer -> main (invoke): dispatch a semantic player action. */
  dispatch: 'player:dispatch',
  /** renderer -> main (invoke): open the native file picker, returns a path. */
  openFile: 'player:open-file',
  /** renderer -> main (invoke): fetch a full snapshot of the player state. */
  getState: 'player:get-state',
  /** main -> renderer (send): full player-state snapshot push. */
  stateChanged: 'player:state-changed',
  /** main -> renderer (send): a screenshot was written to disk. */
  screenshotSaved: 'player:screenshot-saved',
  /** renderer -> main (invoke): read persisted settings. */
  getSettings: 'settings:get',
  /** renderer -> main (invoke): merge a settings patch, returns the result. */
  updateSettings: 'settings:update',
  /** main -> renderer (send): settings changed (broadcast to all windows). */
  settingsChanged: 'settings:changed',
  /** renderer -> main (invoke): read the group's shared annotation-control state. */
  getAnnotationControl: 'player:get-annotation-control',
  /** renderer -> main (send): patch the group's shared annotation-control state. */
  setAnnotationControl: 'player:set-annotation-control',
  /** main -> renderer (send): annotation-control patch (broadcast to the group). */
  annotationControlChanged: 'player:annotation-control-changed',
  /** renderer -> main (send): open/close the pop-out controls window. */
  setControlsPopout: 'player:set-controls-popout',
  /** main -> renderer (send): the pop-out controls window opened/closed. */
  popoutChanged: 'player:popout-changed',
  /** renderer -> main (send): open/close the pop-out analysis-panels window. */
  setPanelPopout: 'player:set-panel-popout',
  /** main -> renderer (send): the pop-out panels window opened/closed. */
  panelPopoutChanged: 'player:panel-popout-changed',
  /** renderer -> main (send): the on-screen video region (physical px). */
  setVideoBounds: 'player:set-video-bounds',
  /** renderer -> main (invoke): grab a downscaled frame of the video for tracking. */
  captureFrame: 'player:capture-frame',
  /** renderer -> main (send): capture a screenshot and open the editor window. */
  openScreenshotEditor: 'player:open-screenshot-editor',
  /** renderer -> main (invoke): the editor window fetches its captured image. */
  getEditorPayload: 'editor:get-payload',
  /** renderer -> main (invoke): save the edited image; resolves to the path or null. */
  saveScreenshot: 'editor:save',
  /** renderer -> main (send): close the editor window. */
  closeEditor: 'editor:close',
  /** renderer -> main (send): open a new, independent player window. */
  newWindow: 'app:new-window',
  /** renderer -> main (invoke): pick a folder, returns the path or null. */
  chooseDirectory: 'app:choose-directory',
  /** renderer -> main (invoke): which upscale models are installed on disk. */
  upscaleModelStatus: 'upscale:status',
  /** renderer -> main (invoke): download (if needed) + build the inference session. */
  loadUpscaleModel: 'upscale:load-model',
  /** renderer -> main (invoke): super-resolve one image tile on the loaded model. */
  upscaleTile: 'upscale:tile',
  /** renderer -> main (invoke): delete a cached model; resolves to whether it existed. */
  removeUpscaleModel: 'upscale:remove-model',
  /** main -> renderer (send): download progress for a model fetch. */
  upscaleProgress: 'upscale:progress',
  /** renderer -> main (invoke): run an AI image op (enhance/regenerate) via the user's key. */
  generateImage: 'image:generate',
  /** renderer -> main (invoke): manually trigger an update check (no-op in dev). */
  checkForUpdates: 'update:check',
  /** renderer -> main (send): quit and install a downloaded update. */
  installUpdate: 'update:install',
  /** main -> renderer (send): auto-update status changed (broadcast to all windows). */
  updateStatusChanged: 'update:status-changed',
  /** renderer -> main (invoke): the running app's version string. */
  appVersion: 'app:version',
  /** renderer -> main (invoke): read a file's persisted metadata (resume/bookmarks). */
  getFileMetadata: 'files:get-metadata',
  /** renderer -> main (send): record a file's resume position (debounced on disk). */
  saveResume: 'files:save-resume',
  /** renderer -> main (send): replace a file's bookmark list. */
  saveBookmarks: 'files:save-bookmarks',
  /** renderer -> main (invoke): the recent-files list, newest first. */
  getRecentFiles: 'files:get-recents',
  /** renderer -> main (invoke): build/fetch the seek-bar thumbnail sprite sheet. */
  getThumbnailSheet: 'files:get-thumbnails',
  /** renderer -> main (invoke): export a time range as a clip / GIF / PNG sequence. */
  exportRange: 'export:range',
  /** main -> renderer (send): export progress changed (broadcast to the group). */
  exportStatusChanged: 'export:status-changed',
  /** renderer -> main (send): link/unlink this window's transport to its peers. */
  setComparisonLink: 'compare:set-link',
  /** main -> renderer (send): this window's transport-link state changed. */
  comparisonLinkChanged: 'compare:link-changed'
} as const

/**
 * What an export produces:
 *   - `mp4`    — an H.264 + AAC clip.
 *   - `gif`    — a looping, downscaled, audioless GIF.
 *   - `pngseq` — every frame of the range as numbered PNGs in a folder.
 */
export type ExportFormat = 'mp4' | 'gif' | 'pngseq'

/** Payload for {@link IpcChannels.exportRange}: the range (seconds) + target format. */
export interface ExportRequest {
  startSeconds: number
  endSeconds: number
  format: ExportFormat
}

/** Broadcast export progress (drives the export toast). */
export type ExportStatus =
  | { phase: 'idle' }
  | { phase: 'running'; format: ExportFormat }
  | { phase: 'done'; format: ExportFormat; outputPath: string }
  | { phase: 'error'; message: string }

/** Payload for {@link IpcChannels.saveResume}. */
export interface ResumePayload {
  path: string
  pos: number
  duration: number
}

/**
 * A sprite sheet of evenly-spaced preview frames for the seek bar, packed
 * `cols × rows` into one JPEG (sent as a data URL). Cell `i` (0-based,
 * row-major) covers the fraction `i / (count - 1)` of the timeline.
 */
export interface ThumbnailSheet {
  dataUrl: string
  cols: number
  rows: number
  count: number
  cellWidth: number
  cellHeight: number
}

/**
 * The on-screen rectangle the video should occupy, in physical pixels relative
 * to the window's client area. The renderer measures the area not covered by
 * the title bar / transport bar and reports it so mpv stays fully visible.
 */
export interface VideoBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * A downscaled BGRA frame of the on-screen video region, captured natively for
 * motion tracking. `data` is top-down BGRA, length `w*h*4`.
 */
export interface CapturedFrame {
  w: number
  h: number
  data: Uint8Array
}

/**
 * The captured frame handed to a screenshot-editor window: a PNG `data:` URL
 * (full-quality, straight from mpv) plus a suggested file name for saving.
 */
export interface EditorPayload {
  image: string
  suggestedName: string
}

/** Which backend the upscale session actually bound to: GPU (DirectML) or CPU. */
export type UpscaleBackend = 'gpu' | 'cpu'

/** A block of RGBA pixels (top-down, length `width*height*4`) crossing IPC. */
export interface UpscaleTile {
  rgba: Uint8Array
  width: number
  height: number
}

/** Options for {@link PlayerApi.saveScreenshot}. */
export interface SaveScreenshotOptions {
  /** When true, prompt with a native Save-As dialog (custom path/name). */
  saveAs: boolean
  /** Suggested file name (used for the default folder and the dialog). */
  suggestedName: string
}

/** Channels for the custom (frameless) window controls. */
export const WindowChannels = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  maximizedChanged: 'window:maximized-changed',
  toggleFullscreen: 'window:toggle-fullscreen',
  isFullscreen: 'window:is-fullscreen',
  fullscreenChanged: 'window:fullscreen-changed',
  toggleAlwaysOnTop: 'window:toggle-always-on-top',
  isAlwaysOnTop: 'window:is-always-on-top',
  alwaysOnTopChanged: 'window:always-on-top-changed',
  moveStart: 'window:move-start',
  move: 'window:move',
  resizeStart: 'window:resize-start',
  resize: 'window:resize'
} as const

/** Edge/corner being dragged when resizing the window. */
export type WindowEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** A point in screen coordinates (from a pointer event's screenX/screenY). */
export interface ScreenPoint {
  x: number
  y: number
}

/**
 * Custom window controls exposed on `window.windowControls`. The frameless
 * video window is driven entirely from the overlay through these.
 */
export interface WindowControlsApi {
  minimize(): void
  toggleMaximize(): void
  close(): void
  isMaximized(): Promise<boolean>
  onMaximizedChanged(callback: (maximized: boolean) => void): () => void
  toggleFullscreen(): void
  isFullscreen(): Promise<boolean>
  onFullscreenChanged(callback: (fullscreen: boolean) => void): () => void
  /** Toggle always-on-top (picture-in-picture style) for this window. */
  toggleAlwaysOnTop(): void
  isAlwaysOnTop(): Promise<boolean>
  onAlwaysOnTopChanged(callback: (onTop: boolean) => void): () => void
  /** Begin a titlebar drag; pass the pointer's screen position. */
  moveStart(point: ScreenPoint): void
  /** Continue a titlebar drag with the pointer's current screen position. */
  move(point: ScreenPoint): void
  /** Begin an edge/corner resize. */
  resizeStart(edge: WindowEdge, point: ScreenPoint): void
  /** Continue a resize with the pointer's current screen position. */
  resize(point: ScreenPoint): void
}

/**
 * The typed surface exposed on `window.api` by the preload script.
 * Subscription methods return an unsubscribe function.
 */
export interface PlayerApi {
  dispatch(action: PlayerAction): Promise<void>
  openFile(): Promise<string | null>
  getState(): Promise<PlayerState>
  onStateChanged(callback: (state: PlayerState) => void): () => void
  onScreenshotSaved(callback: (filePath: string) => void): () => void

  // Settings
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
  onSettingsChanged(callback: (settings: AppSettings) => void): () => void

  // Annotation controls (shared across the window group: overlay + pop-out)
  /** Read the group's current shared annotation-control state. */
  getAnnotationControl(): Promise<AnnotationControl>
  /** Patch the group's shared annotation-control state (broadcast to the group). */
  setAnnotationControl(patch: Partial<AnnotationControl>): void
  /** Subscribe to annotation-control patches pushed to the group. */
  onAnnotationControlChanged(callback: (patch: Partial<AnnotationControl>) => void): () => void

  // Pop-out controls window
  setControlsPopout(open: boolean): void
  onPopoutChanged(callback: (open: boolean) => void): () => void

  // Pop-out analysis-panels window (Pro)
  setPanelPopout(open: boolean): void
  onPanelPopoutChanged(callback: (open: boolean) => void): () => void

  /** Report the on-screen video region so mpv stays clear of the chrome. */
  setVideoBounds(bounds: VideoBounds): void

  /** Grab a downscaled frame of the video region (for tracking), or null. */
  captureFrame(maxWidth?: number): Promise<CapturedFrame | null>

  // Screenshot editor
  /** Capture a full-quality screenshot and open it in an editor window. */
  openScreenshotEditor(): void
  /** Editor window: fetch its captured image + suggested name, or null. */
  getScreenshotEditorPayload(): Promise<EditorPayload | null>
  /** Editor window: save the edited PNG bytes; resolves to the path or null. */
  saveScreenshot(bytes: Uint8Array, opts: SaveScreenshotOptions): Promise<string | null>
  /** Editor window: close itself. */
  closeScreenshotEditor(): void

  /** Open a new, independent player window. */
  newWindow(): void

  /** Open a folder picker; resolves to the chosen path or null. */
  chooseDirectory(): Promise<string | null>

  // Upscaling models (inference runs in the main process via onnxruntime-node)
  /** Report which upscale models are downloaded/cached on disk. */
  upscaleModelStatus(): Promise<UpscaleModelStatus>
  /**
   * Download (if needed) the model and build its inference session in the main
   * process. Resolves with the backend that bound — `gpu` (DirectML) or `cpu`.
   */
  loadUpscaleModel(id: UpscaleModelId): Promise<{ backend: UpscaleBackend }>
  /** Super-resolve one RGBA tile on the currently loaded model. */
  upscaleTile(id: UpscaleModelId, tile: UpscaleTile): Promise<UpscaleTile>
  /** Delete a cached model; resolves to whether a file was removed. */
  removeUpscaleModel(id: UpscaleModelId): Promise<boolean>
  /** Subscribe to model download progress. */
  onUpscaleProgress(callback: (progress: UpscaleProgress) => void): () => void

  // AI image generation (bring-your-own-key; the HTTP call runs in main)
  /**
   * Transform the supplied frame with the configured provider + key (enhance or
   * regenerate). Rejects with a human-readable message on missing key / API
   * error.
   */
  generateImage(request: ImageGenRequest): Promise<ImageGenResult>

  // Auto-update (electron-updater runs in main; checks/downloads happen there)
  /** Trigger an update check now. No-op in dev / unpackaged builds. */
  checkForUpdates(): Promise<void>
  /** Quit and install an already-downloaded update (restarts into the new version). */
  installUpdate(): void
  /** Subscribe to auto-update status changes. */
  onUpdateStatusChanged(callback: (status: UpdateStatus) => void): () => void
  /** The running app's version (e.g. "0.1.0"), for display. */
  getAppVersion(): Promise<string>

  // Per-file metadata (resume position, recents, bookmarks)
  /** Read a file's persisted metadata, or null when unknown. */
  getFileMetadata(path: string): Promise<FileMetadata | null>
  /** Record a file's resume position (bumps last-opened; debounced on disk). */
  saveResume(payload: ResumePayload): void
  /** Replace a file's bookmark list. */
  saveBookmarks(path: string, bookmarks: Marker[]): void
  /** The recent-files list, newest first. */
  getRecentFiles(): Promise<RecentFile[]>
  /** Build (once, cached) and fetch the seek-bar thumbnail sheet, or null. */
  getThumbnailSheet(path: string, duration: number): Promise<ThumbnailSheet | null>

  // Export (mp4 / gif / PNG sequence; encoded headlessly by mpv in main)
  /**
   * Export a time range of the current file. Prompts for a destination (file for
   * clip/GIF, folder for a PNG sequence). Resolves to the output path/dir, or
   * null if cancelled or it failed; progress is also broadcast via
   * {@link onExportStatusChanged}.
   */
  exportRange(request: ExportRequest): Promise<string | null>
  /** Subscribe to export progress (running / done / error). */
  onExportStatusChanged(callback: (status: ExportStatus) => void): () => void

  // Comparison: link this window's transport (play/pause/seek/step/speed) to
  // every other linked window, so several videos scrub in lock-step.
  /** Link or unlink this window's transport to its peers. */
  setComparisonLink(linked: boolean): void
  /** Subscribe to this window's transport-link state. */
  onComparisonLinkChanged(callback: (linked: boolean) => void): () => void
}
