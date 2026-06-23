import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme } from 'electron'
import { InstanceManager } from './app/InstanceManager'
import { registerGlobalBridge } from './ipc/registerGlobalBridge'
import { registerSettingsBridge } from './ipc/registerSettingsBridge'
import { registerFileMetadataBridge } from './ipc/registerFileMetadataBridge'
import { registerThumbnailBridge } from './ipc/registerThumbnailBridge'
import { FileMetadataStore } from './persist/FileMetadataStore'
import { ThumbnailService } from './thumbnails/ThumbnailService'
import { locateMpv } from './mpv/locateMpv'
import { registerUpscaleBridge } from './ipc/registerUpscaleBridge'
import { registerImageGenBridge } from './ipc/registerImageGenBridge'
import { registerUpdateBridge } from './ipc/registerUpdateBridge'
import { UpdateService } from './update/UpdateService'
import { SettingsStore } from './settings/SettingsStore'
import { UpscaleModelStore } from './upscale/UpscaleModelStore'
import { UpscaleService } from './upscale/UpscaleService'
import { ImageGenService } from './imagegen/ImageGenService'
import { fileFromArgv } from './app/fileArg'

/**
 * Main-process entry point.
 *
 * One process hosts any number of independent player windows (each its own mpv
 * engine) via the {@link InstanceManager}; the IPC router dispatches each
 * message to the instance that sent it. A single-instance lock keeps everything
 * in one process — a second launch ("Open with FramePlayer") opens a new window
 * here instead of starting another app.
 */

let manager: InstanceManager | null = null
let upscale: UpscaleService | null = null
let updates: UpdateService | null = null
let fileMetadata: FileMetadataStore | null = null
let disposeBridge: () => void = () => {}
let disposeSettings: () => void = () => {}
let disposeFileMetadata: () => void = () => {}
let disposeThumbnails: () => void = () => {}
let disposeUpscale: () => void = () => {}
let disposeImageGen: () => void = () => {}
let disposeUpdate: () => void = () => {}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    void manager?.createInstance(fileFromArgv(argv))
  })

  app.whenReady().then(() => {
    // Force a dark native window frame (title bar, controls) on every window,
    // regardless of the user's Windows light/dark setting, to match the app.
    nativeTheme.themeSource = 'dark'

    const settings = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
    fileMetadata = new FileMetadataStore(join(app.getPath('userData'), 'file-metadata.json'))
    const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
    const thumbnails = new ThumbnailService(locateMpv(resourcesDir), () => app.getPath('temp'))
    const upscaleModels = new UpscaleModelStore(join(app.getPath('userData'), 'models', 'upscale'))
    upscale = new UpscaleService(upscaleModels)
    const imageGen = new ImageGenService(settings)
    updates = new UpdateService()
    manager = new InstanceManager(settings)
    disposeSettings = registerSettingsBridge(settings)
    disposeFileMetadata = registerFileMetadataBridge(fileMetadata)
    disposeThumbnails = registerThumbnailBridge(thumbnails)
    disposeUpscale = registerUpscaleBridge(upscale)
    disposeImageGen = registerImageGenBridge(imageGen)
    disposeUpdate = registerUpdateBridge(updates)
    disposeBridge = registerGlobalBridge(manager)

    void manager.createInstance(fileFromArgv(process.argv))

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void manager?.createInstance()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  manager?.disposeAll()
  upscale?.dispose()
  updates?.dispose()
  fileMetadata?.flush()
  disposeBridge()
  disposeSettings()
  disposeFileMetadata()
  disposeThumbnails()
  disposeUpscale()
  disposeImageGen()
  disposeUpdate()
})
