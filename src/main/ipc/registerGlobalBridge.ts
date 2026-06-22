import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import {
  IpcChannels,
  WindowChannels,
  type SaveScreenshotOptions,
  type ScreenPoint,
  type VideoBounds,
  type WindowEdge
} from '@shared/ipc'
import type { PlayerAction } from '@shared/player-actions'
import type { AnnotationControl } from '@shared/annotation'
import type { InstanceManager } from '../app/InstanceManager'
import type { PlayerInstance } from '../app/PlayerInstance'

/**
 * Registers the app-wide IPC handlers ONCE and routes each call to the
 * {@link PlayerInstance} that owns the sending renderer. This is what makes
 * multiple independent player windows possible: handlers are global (one per
 * channel), but every message is dispatched to the right instance.
 *
 * @returns a disposer that removes every handler/listener.
 */
export function registerGlobalBridge(manager: InstanceManager): () => void {
  const handle = (
    channel: string,
    fn: (instance: PlayerInstance, event: IpcMainInvokeEvent, ...args: never[]) => unknown
  ): void => {
    ipcMain.handle(channel, (event, ...args) => {
      const instance = manager.forSender(event.sender)
      return instance ? fn(instance, event, ...(args as never[])) : undefined
    })
  }

  const on = (
    channel: string,
    fn: (instance: PlayerInstance, event: IpcMainEvent, ...args: never[]) => void
  ): void => {
    ipcMain.on(channel, (event, ...args) => {
      const instance = manager.forSender(event.sender)
      if (instance) fn(instance, event, ...(args as never[]))
    })
  }

  // --- Player ---
  handle(IpcChannels.getState, (i) => i.getState())
  handle(IpcChannels.dispatch, (i, _e, action: PlayerAction) => i.dispatch(action))
  handle(IpcChannels.openFile, (i) => i.openFile())
  handle(IpcChannels.chooseDirectory, (i) => i.chooseDirectory())
  on(IpcChannels.setControlsPopout, (i, _e, open: boolean) => i.setControlsPopout(open))
  handle(IpcChannels.getAnnotationControl, (i) => i.getAnnotationControl())
  on(IpcChannels.setAnnotationControl, (i, _e, patch: Partial<AnnotationControl>) =>
    i.setAnnotationControl(patch)
  )
  on(IpcChannels.setVideoBounds, (i, _e, bounds: VideoBounds) => i.setVideoBounds(bounds))
  handle(IpcChannels.captureFrame, (i, _e, maxWidth?: number) => i.captureFrame(maxWidth))

  // --- Screenshot editor ---
  on(IpcChannels.openScreenshotEditor, (i) => void i.openScreenshotEditor())
  handle(IpcChannels.getEditorPayload, (i, e) => i.getEditorPayload(e.sender))
  handle(IpcChannels.saveScreenshot, (i, e, bytes: Uint8Array, opts: SaveScreenshotOptions) =>
    i.saveScreenshot(e.sender, bytes, opts)
  )
  on(IpcChannels.closeEditor, (i, e) => i.closeEditor(e.sender))

  // --- Window controls (act on the window that sent the message) ---
  on(WindowChannels.minimize, (i, e) => i.minimize(e.sender))
  on(WindowChannels.toggleMaximize, (i, e) => i.toggleMaximize(e.sender))
  on(WindowChannels.close, (i, e) => i.close(e.sender))
  handle(WindowChannels.isMaximized, (i, e) => i.isMaximized(e.sender))
  on(WindowChannels.toggleFullscreen, (i, e) => i.toggleFullscreen(e.sender))
  handle(WindowChannels.isFullscreen, (i, e) => i.isFullscreen(e.sender))
  on(WindowChannels.moveStart, (i, _e, p: ScreenPoint) => i.moveStart(p))
  on(WindowChannels.move, (i, _e, p: ScreenPoint) => i.move(p))
  on(WindowChannels.resizeStart, (i, _e, edge: WindowEdge, p: ScreenPoint) => i.resizeStart(edge, p))
  on(WindowChannels.resize, (i, _e, p: ScreenPoint) => i.resize(p))

  // --- App ---
  ipcMain.on(IpcChannels.newWindow, () => void manager.createInstance())

  const channels = [
    ...Object.values(IpcChannels),
    ...Object.values(WindowChannels)
  ]

  return () => {
    for (const channel of channels) {
      ipcMain.removeHandler(channel)
      ipcMain.removeAllListeners(channel)
    }
  }
}
