import { join, basename } from 'node:path'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { app, dialog, BrowserWindow, type WebContents } from 'electron'
import {
  IpcChannels,
  WindowChannels,
  type EditorPayload,
  type SaveScreenshotOptions,
  type ScreenPoint,
  type VideoBounds,
  type WindowEdge
} from '@shared/ipc'
import type { PlayerAction } from '@shared/player-actions'
import type { PlayerState } from '@shared/player-state'
import { DEFAULT_ANNOTATION_CONTROL, type AnnotationControl } from '@shared/annotation'
import type { SettingsStore } from '../settings/SettingsStore'
import { PlayerWindows } from '../window/PlayerWindows'
import { resizeRect, type Rect } from '../window/resizeRect'
import { locateMpv } from '../mpv/locateMpv'
import { MpvEngine } from '../mpv/MpvEngine'
import { PlayerStateStore } from '../state/PlayerStateStore'
import { applyPropertyChange, OBSERVED_PROPERTIES } from '../state/playerStateBindings'
import { PlayerService } from './PlayerService'
import { getWindowId } from '../embedding/windowHandle'
import { MpvEmbedder } from '../embedding/MpvEmbedder'
import { captureVideoRegion } from '../capture/screenCapture'
import type { CapturedFrame } from '@shared/ipc'
import { buildScreenshotPath } from '../capture/screenshotPath'
import { createScreenshotEditor } from '../window/createScreenshotEditor'

const MIN_SIZE = { width: 840, height: 520 }

const VIDEO_FILE_FILTERS = [
  { name: 'Video', extensions: ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'ts'] },
  { name: 'All Files', extensions: ['*'] }
]

interface GestureAnchor {
  pointer: ScreenPoint
  bounds: Rect
  edge?: WindowEdge
}

/** Resources live at <repo>/resources in dev and process.resourcesPath when packaged. */
function resolveResourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
}

/**
 * One independent player: its own window pair, mpv engine, state store and
 * window gestures. Multiple instances run side by side so several videos play
 * at once. Instances register NO global IPC; the app-level router (see
 * registerGlobalBridge) resolves the instance by the sender and calls these
 * methods, and state is broadcast only to this instance's renderers.
 */
export class PlayerInstance {
  readonly windows: PlayerWindows
  private readonly store: PlayerStateStore
  private readonly service: PlayerService
  private readonly engine: MpvEngine | null
  private readonly embedder: MpvEmbedder
  private anchor: GestureAnchor | null = null
  /** Open screenshot-editor windows + their captured image, keyed by webContents id. */
  private readonly editors = new Map<number, { window: BrowserWindow; payload: EditorPayload }>()
  /** Annotation tool state shared across this group's renderers (overlay + pop-out). */
  private annotationControl: AnnotationControl = { ...DEFAULT_ANNOTATION_CONTROL }

  private constructor(
    private readonly settings: SettingsStore,
    private readonly initialFile?: string | null
  ) {
    const binaryPath = locateMpv(resolveResourcesDir())

    this.store = new PlayerStateStore()
    this.engine = binaryPath ? new MpvEngine({ binaryPath }) : null
    this.windows = new PlayerWindows(
      (open) => this.emit(IpcChannels.popoutChanged, open),
      (popout) => this.bindWindowControlEvents(popout, popout.webContents)
    )
    this.embedder = new MpvEmbedder(this.windows.video)
    this.service = new PlayerService({
      store: this.store,
      engine: this.engine,
      screenshotDir: () => this.resolveScreenshotDir(),
      onScreenshotSaved: (filePath) => this.emit(IpcChannels.screenshotSaved, filePath),
      mpvBinaryPath: binaryPath,
      tempDir: () => app.getPath('temp')
    })

    this.wireWindowEvents()
    this.store.subscribe((state) => this.emit(IpcChannels.stateChanged, state))
  }

  static async create(settings: SettingsStore, initialFile?: string | null): Promise<PlayerInstance> {
    const instance = new PlayerInstance(settings, initialFile)
    await instance.start()
    return instance
  }

  /** The configured screenshot folder, or the default under Pictures. */
  private resolveScreenshotDir(): string {
    const configured = this.settings.getSettings().screenshotDir.trim()
    return configured || join(app.getPath('pictures'), 'FramePlayer')
  }

  /** Opens a folder picker (for the screenshot-folder setting). */
  async chooseDirectory(): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.windows.overlay, {
      title: 'Choose screenshot folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  }

  private async start(): Promise<void> {
    if (!this.engine) {
      this.store.setEngine({
        ready: false,
        error:
          'mpv was not found. Place mpv.exe in resources/mpv, set MPV_PATH, or install mpv on PATH.'
      })
      return
    }
    this.wireEngine(this.engine, this.store, this.embedder, this.initialFile)
    await this.startEngine(this.engine, this.store)
  }

  // --- Identity / messaging ---

  /** True if the given renderer (overlay, popout, or an editor) belongs here. */
  ownsWebContents(wc: WebContents): boolean {
    return this.windows.rendererWebContents.some((c) => c.id === wc.id) || this.editors.has(wc.id)
  }

  private emit(channel: string, ...args: unknown[]): void {
    for (const wc of this.windows.rendererWebContents) {
      if (!wc.isDestroyed()) wc.send(channel, ...args)
    }
  }

  // --- Player API (called by the router) ---

  getState(): PlayerState {
    return this.store.getState()
  }

  dispatch(action: PlayerAction): Promise<void> {
    return this.service.dispatch(action)
  }

  loadFile(path: string): void {
    void this.service.dispatch({ type: 'load', path })
  }

  async openFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog(this.windows.overlay, {
      title: 'Open video',
      properties: ['openFile'],
      filters: VIDEO_FILE_FILTERS
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  }

  setVideoBounds(bounds: VideoBounds): void {
    this.embedder.setBounds(bounds)
  }

  /** Grabs a downscaled frame of this instance's video region for tracking. */
  captureFrame(maxWidth?: number): CapturedFrame | null {
    return captureVideoRegion(getWindowId(this.video), maxWidth)
  }

  // --- Screenshot editor ---

  /**
   * Captures a full-quality PNG of the current frame and opens it in a new
   * editor window. mpv writes to a temp file (the IPC awaits the write), which
   * we read back as a data URL and hand to the window via {@link getEditorPayload}.
   */
  async openScreenshotEditor(): Promise<void> {
    const { playback } = this.store.getState()
    const tempPath = join(app.getPath('temp'), `frameplayer-edit-${Date.now()}.png`)

    let dataUrl: string
    try {
      await this.service.screenshotTo(tempPath)
      const bytes = readFileSync(tempPath)
      dataUrl = `data:image/png;base64,${bytes.toString('base64')}`
    } catch {
      return
    } finally {
      rmSync(tempPath, { force: true })
    }

    const suggestedName = basename(
      buildScreenshotPath(this.resolveScreenshotDir(), playback.filePath, playback.frame)
    )

    const window = createScreenshotEditor()
    const id = window.webContents.id
    this.editors.set(id, { window, payload: { image: dataUrl, suggestedName } })
    this.bindWindowControlEvents(window, window.webContents)
    window.on('closed', () => this.editors.delete(id))
  }

  /** The captured image + suggested name for the editor window behind `wc`. */
  getEditorPayload(wc: WebContents): EditorPayload | null {
    return this.editors.get(wc.id)?.payload ?? null
  }

  /**
   * Writes the edited PNG bytes to disk. With `saveAs`, prompts a native dialog
   * (custom path); otherwise saves into the configured folder under the
   * suggested name. Returns the written path, or null if cancelled.
   */
  async saveScreenshot(
    sender: WebContents,
    bytes: Uint8Array,
    opts: SaveScreenshotOptions
  ): Promise<string | null> {
    const dir = this.resolveScreenshotDir()
    const editorWindow = this.editors.get(sender.id)?.window
    let target = join(dir, opts.suggestedName)

    if (opts.saveAs) {
      const result = await dialog.showSaveDialog(editorWindow ?? this.windows.overlay, {
        title: 'Save screenshot',
        defaultPath: target,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      })
      if (result.canceled || !result.filePath) return null
      target = result.filePath
    } else {
      mkdirSync(dir, { recursive: true })
    }

    writeFileSync(target, Buffer.from(bytes))
    return target
  }

  /** Closes the editor window behind `wc` (its own close button). */
  closeEditor(wc: WebContents): void {
    const editor = this.editors.get(wc.id)
    if (editor && !editor.window.isDestroyed()) editor.window.close()
  }

  setControlsPopout(open: boolean): void {
    this.windows.setControlsPopout(open)
  }

  // --- Annotation controls (shared across the group) ---

  /** The current shared annotation-control state (seeds a newly opened window). */
  getAnnotationControl(): AnnotationControl {
    return this.annotationControl
  }

  /** Merges a control patch and broadcasts it to the group (overlay + pop-out). */
  setAnnotationControl(patch: Partial<AnnotationControl>): void {
    this.annotationControl = { ...this.annotationControl, ...patch }
    this.emit(IpcChannels.annotationControlChanged, patch)
  }

  // --- Window controls (frameless) ---

  private get video(): BrowserWindow {
    return this.windows.video
  }

  /**
   * The window a control message should act on. The player UI lives in the
   * transparent overlay but drives the real video window beneath it; the pop-out
   * and screenshot-editor windows drive themselves.
   */
  private controlTargetFor(sender: WebContents): BrowserWindow | null {
    if (sender.id === this.windows.overlay.webContents.id) return this.video
    return BrowserWindow.fromWebContents(sender)
  }

  minimize(sender: WebContents): void {
    this.controlTargetFor(sender)?.minimize()
  }

  toggleMaximize(sender: WebContents): void {
    const window = this.controlTargetFor(sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  }

  close(sender: WebContents): void {
    this.controlTargetFor(sender)?.close()
  }

  isMaximized(sender: WebContents): boolean {
    return this.controlTargetFor(sender)?.isMaximized() ?? false
  }

  toggleFullscreen(sender: WebContents): void {
    const window = this.controlTargetFor(sender)
    if (window) window.setFullScreen(!window.isFullScreen())
  }

  isFullscreen(sender: WebContents): boolean {
    return this.controlTargetFor(sender)?.isFullScreen() ?? false
  }

  moveStart(point: ScreenPoint): void {
    this.anchor = { pointer: point, bounds: this.video.getBounds() }
  }

  move(point: ScreenPoint): void {
    if (!this.anchor || this.video.isMaximized() || this.video.isFullScreen()) return
    this.video.setBounds({
      x: this.anchor.bounds.x + (point.x - this.anchor.pointer.x),
      y: this.anchor.bounds.y + (point.y - this.anchor.pointer.y),
      width: this.anchor.bounds.width,
      height: this.anchor.bounds.height
    })
  }

  resizeStart(edge: WindowEdge, point: ScreenPoint): void {
    this.anchor = { pointer: point, bounds: this.video.getBounds(), edge }
  }

  resize(point: ScreenPoint): void {
    if (!this.anchor?.edge || this.video.isFullScreen() || this.video.isMaximized()) return
    this.video.setBounds(
      resizeRect(
        this.anchor.bounds,
        this.anchor.edge,
        point.x - this.anchor.pointer.x,
        point.y - this.anchor.pointer.y,
        MIN_SIZE
      )
    )
  }

  dispose(): void {
    for (const { window } of this.editors.values()) {
      if (!window.isDestroyed()) window.destroy()
    }
    this.editors.clear()
    this.service.dispose()
    this.embedder.dispose()
    this.engine?.dispose()
    this.windows.dispose()
  }

  // --- Wiring ---

  private wireWindowEvents(): void {
    // The player UI lives in the overlay, so the video window's transitions are
    // reported there. The pop-out and editor windows are wired the same way when
    // they're created (each reports to its own renderer).
    this.bindWindowControlEvents(this.video, this.windows.overlay.webContents)
  }

  /**
   * Forwards a frameless window's maximize/fullscreen transitions to the
   * renderer that draws its title bar, so the maximize/restore and fullscreen
   * buttons stay in sync. Broadcast the value implied by the event; querying
   * isMaximized()/isFullScreen() inside the handler returns the pre-transition
   * value on Windows.
   */
  private bindWindowControlEvents(window: BrowserWindow, renderer: WebContents): void {
    const send = (channel: string, value: boolean): void => {
      if (!renderer.isDestroyed()) renderer.send(channel, value)
    }
    window.on('maximize', () => send(WindowChannels.maximizedChanged, true))
    window.on('unmaximize', () => send(WindowChannels.maximizedChanged, false))
    window.on('enter-full-screen', () => send(WindowChannels.fullscreenChanged, true))
    window.on('leave-full-screen', () => send(WindowChannels.fullscreenChanged, false))
  }

  private wireEngine(
    engine: MpvEngine,
    store: PlayerStateStore,
    embedder: MpvEmbedder,
    initialFile?: string | null
  ): void {
    engine.on('ready', () => {
      engine.controller.on('property-change', ({ name, value }) => {
        // While a smooth-loop proxy is playing, properties arrive in proxy time;
        // the service remaps them back into original-file terms for the UI.
        const remapped = this.service.remapObservedProperty(name, value)
        store.update((state) => applyPropertyChange(state, remapped.name, remapped.value))
      })
      engine.controller.on('event', (e) => {
        if (e.event === 'file-loaded') embedder.raiseNow()
      })
      void engine.controller.observeProperties(OBSERVED_PROPERTIES)
      store.setEngine({ ready: true, error: null })
      embedder.pollUntilRaised()

      const startupFile = initialFile ?? process.env['FRAMEPLAYER_DEV_AUTOLOAD']
      if (startupFile) void engine.controller.loadFile(startupFile)
    })

    engine.on('error', (err: Error) => store.setEngine({ error: err.message }))
    engine.on('exit', (code: number | null) =>
      store.setEngine({ ready: false, error: `mpv exited unexpectedly (code ${code ?? 'unknown'}).` })
    )
  }

  private async startEngine(engine: MpvEngine, store: PlayerStateStore): Promise<void> {
    try {
      await engine.start(getWindowId(this.video))
    } catch (err) {
      store.setEngine({
        ready: false,
        error: `Failed to start mpv: ${err instanceof Error ? err.message : String(err)}`
      })
    }
  }
}
