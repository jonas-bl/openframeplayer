import { BrowserWindow } from 'electron'

/**
 * Sends an IPC message to every live renderer (overlay + pop-out controls).
 *
 * State, settings and screenshot notifications must reach all windows so they
 * stay in sync; windows without the bridge (the bare video host) simply ignore
 * the message.
 */
export function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}
