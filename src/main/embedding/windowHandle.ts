import type { BrowserWindow } from 'electron'

/**
 * Converts the native window-handle buffer Electron returns into the numeric
 * handle mpv's `--wid` expects.
 *
 * On Windows `getNativeWindowHandle()` returns the HWND as a little-endian
 * pointer buffer (8 bytes on x64, 4 on x86). Pure and testable so the byte
 * handling is verified without a real window. Returned as `bigint` because a
 * 64-bit handle can exceed `Number.MAX_SAFE_INTEGER`.
 */
export function bufferToWindowId(handle: Buffer): bigint {
  if (handle.length >= 8) return handle.readBigUInt64LE(0)
  if (handle.length >= 4) return BigInt(handle.readUInt32LE(0))
  throw new Error(`Unexpected native window handle size: ${handle.length} bytes`)
}

/** Reads the embeddable native window id (HWND) from a BrowserWindow. */
export function getWindowId(window: BrowserWindow): bigint {
  return bufferToWindowId(window.getNativeWindowHandle())
}
