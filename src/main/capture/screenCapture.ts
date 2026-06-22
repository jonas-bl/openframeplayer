import koffi from 'koffi'
import { findChildWindowByClass } from '../embedding/win32'

/**
 * Native screen-region capture of the embedded mpv video (Windows only).
 *
 * mpv renders with a hardware (d3d11) video output, so `BitBlt`/`PrintWindow`
 * on its own HWND typically come back black. But the embedder already raises
 * the mpv child window *topmost* at its on-screen rectangle, so we instead
 * `StretchBlt` that rectangle straight off the desktop DC: that reads the
 * composed framebuffer (real HW video) and — because mpv sits above Chromium
 * there — excludes our transparent overlay. The frame is downscaled during the
 * blit to keep it cheap; tracking never needs full resolution.
 *
 * No-ops (returns null) off Windows or before mpv has created its window.
 */

const MPV_WINDOW_CLASS = 'mpv'

const SRCCOPY = 0x00cc0020
const HALFTONE = 4
const DIB_RGB_COLORS = 0
const BI_RGB = 0

interface Gdi {
  GetDC: (hwnd: bigint) => bigint
  ReleaseDC: (hwnd: bigint, hdc: bigint) => number
  GetWindowRect: (hwnd: bigint, rect: Buffer) => boolean
  CreateCompatibleDC: (hdc: bigint) => bigint
  CreateCompatibleBitmap: (hdc: bigint, w: number, h: number) => bigint
  SelectObject: (hdc: bigint, obj: bigint) => bigint
  SetStretchBltMode: (hdc: bigint, mode: number) => number
  StretchBlt: (
    dst: bigint, dx: number, dy: number, dw: number, dh: number,
    src: bigint, sx: number, sy: number, sw: number, sh: number, rop: number
  ) => boolean
  GetDIBits: (
    hdc: bigint, bmp: bigint, start: number, lines: number,
    bits: Buffer, info: Buffer, usage: number
  ) => number
  DeleteObject: (obj: bigint) => boolean
  DeleteDC: (hdc: bigint) => boolean
}

let cached: Gdi | null = null

function gdi(): Gdi | null {
  if (process.platform !== 'win32') return null
  if (cached) return cached
  try {
    const user32 = koffi.load('user32.dll')
    const gdi32 = koffi.load('gdi32.dll')
    cached = {
      GetDC: user32.func('__stdcall', 'GetDC', 'uint64', ['uint64']),
      ReleaseDC: user32.func('__stdcall', 'ReleaseDC', 'int', ['uint64', 'uint64']),
      GetWindowRect: user32.func('__stdcall', 'GetWindowRect', 'bool', ['uint64', 'void*']),
      CreateCompatibleDC: gdi32.func('__stdcall', 'CreateCompatibleDC', 'uint64', ['uint64']),
      CreateCompatibleBitmap: gdi32.func('__stdcall', 'CreateCompatibleBitmap', 'uint64', ['uint64', 'int', 'int']),
      SelectObject: gdi32.func('__stdcall', 'SelectObject', 'uint64', ['uint64', 'uint64']),
      SetStretchBltMode: gdi32.func('__stdcall', 'SetStretchBltMode', 'int', ['uint64', 'int']),
      StretchBlt: gdi32.func('__stdcall', 'StretchBlt', 'bool', [
        'uint64', 'int', 'int', 'int', 'int', 'uint64', 'int', 'int', 'int', 'int', 'uint32'
      ]),
      GetDIBits: gdi32.func('__stdcall', 'GetDIBits', 'int', [
        'uint64', 'uint64', 'uint32', 'uint32', 'void*', 'void*', 'uint32'
      ]),
      DeleteObject: gdi32.func('__stdcall', 'DeleteObject', 'bool', ['uint64']),
      DeleteDC: gdi32.func('__stdcall', 'DeleteDC', 'bool', ['uint64'])
    }
    return cached
  } catch {
    return null
  }
}

/** A downscaled BGRA frame grabbed from the screen. */
export interface CapturedFrame {
  w: number
  h: number
  /** Row-major top-down BGRA (4 bytes/px), length = w*h*4. */
  data: Buffer
}

/** Builds a top-down 32bpp BI_RGB BITMAPINFOHEADER for `GetDIBits`. */
function bitmapInfoHeader(w: number, h: number): Buffer {
  const b = Buffer.alloc(40)
  b.writeUInt32LE(40, 0) // biSize
  b.writeInt32LE(w, 4) // biWidth
  b.writeInt32LE(-h, 8) // biHeight (negative => top-down rows)
  b.writeUInt16LE(1, 12) // biPlanes
  b.writeUInt16LE(32, 14) // biBitCount
  b.writeUInt32LE(BI_RGB, 16) // biCompression
  return b
}

/**
 * Captures the mpv video region of `hostHwnd`, downscaled so the longer side is
 * at most `maxWidth` px. Returns null if mpv has no window yet or capture fails.
 */
export function captureVideoRegion(hostHwnd: bigint, maxWidth = 480): CapturedFrame | null {
  const api = gdi()
  if (!api) return null

  const mpv = findChildWindowByClass(hostHwnd, MPV_WINDOW_CLASS)
  if (!mpv) return null

  const rect = Buffer.alloc(16)
  if (!api.GetWindowRect(mpv, rect)) return null
  const left = rect.readInt32LE(0)
  const top = rect.readInt32LE(4)
  const srcW = rect.readInt32LE(8) - left
  const srcH = rect.readInt32LE(12) - top
  if (srcW <= 0 || srcH <= 0) return null

  const scale = Math.min(1, maxWidth / Math.max(srcW, srcH))
  const dstW = Math.max(1, Math.round(srcW * scale))
  const dstH = Math.max(1, Math.round(srcH * scale))

  const screenDC = api.GetDC(0n)
  if (screenDC === 0n) return null

  let memDC = 0n
  let bmp = 0n
  try {
    memDC = api.CreateCompatibleDC(screenDC)
    bmp = api.CreateCompatibleBitmap(screenDC, dstW, dstH)
    if (memDC === 0n || bmp === 0n) return null

    const old = api.SelectObject(memDC, bmp)
    api.SetStretchBltMode(memDC, HALFTONE)
    const ok = api.StretchBlt(memDC, 0, 0, dstW, dstH, screenDC, left, top, srcW, srcH, SRCCOPY)
    api.SelectObject(memDC, old)
    if (!ok) return null

    const data = Buffer.alloc(dstW * dstH * 4)
    const info = bitmapInfoHeader(dstW, dstH)
    const lines = api.GetDIBits(memDC, bmp, 0, dstH, data, info, DIB_RGB_COLORS)
    if (lines === 0) return null

    return { w: dstW, h: dstH, data }
  } finally {
    if (bmp !== 0n) api.DeleteObject(bmp)
    if (memDC !== 0n) api.DeleteDC(memDC)
    api.ReleaseDC(0n, screenDC)
  }
}
