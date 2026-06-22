import koffi from 'koffi'

/**
 * Minimal Win32 FFI used for mpv embedding.
 *
 * mpv embeds as a child window of the video window but lands *below* Chromium's
 * DirectComposition surface. We raise it back to the top with `SetWindowPos`,
 * which (verified) overrides DComp z-order so the video becomes visible. This
 * is the one unavoidable piece of native glue; it is isolated here and no-ops
 * on non-Windows platforms so the rest of the app stays portable.
 */

const HWND_TOP = 0n
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010
const RAISE_FLAGS = SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE

// DWM (Win11+) rounded-corner control. DWMWA_WINDOW_CORNER_PREFERENCE asks the
// compositor itself to round the frame — native, antialiased, with the correct
// shadow — instead of us clipping pixels. (Dark title bar is forced separately
// via Electron's nativeTheme.themeSource, not a raw DWM attribute.)
const DWMWA_WINDOW_CORNER_PREFERENCE = 33
const DWMWCP_ROUND = 2

interface User32 {
  FindWindowExW: (parent: bigint, after: bigint, className: string | null, title: string | null) => number | bigint
  SetWindowPos: (
    hwnd: bigint,
    insertAfter: bigint,
    x: number,
    y: number,
    cx: number,
    cy: number,
    flags: number
  ) => boolean
}

interface Dwmapi {
  DwmSetWindowAttribute: (hwnd: bigint, attr: number, pv: Buffer, cb: number) => number
}

let cached: User32 | null = null
let cachedDwm: Dwmapi | null = null

function dwmapi(): Dwmapi | null {
  if (process.platform !== 'win32') return null
  if (cachedDwm) return cachedDwm
  try {
    const lib = koffi.load('dwmapi.dll')
    cachedDwm = {
      DwmSetWindowAttribute: lib.func('__stdcall', 'DwmSetWindowAttribute', 'long', [
        'uint64',
        'uint',
        'void*',
        'uint'
      ])
    }
    return cachedDwm
  } catch {
    return null
  }
}

function user32(): User32 | null {
  if (process.platform !== 'win32') return null
  if (cached) return cached
  try {
    const lib = koffi.load('user32.dll')
    cached = {
      FindWindowExW: lib.func('__stdcall', 'FindWindowExW', 'uint64', [
        'uint64',
        'uint64',
        'str16',
        'str16'
      ]),
      SetWindowPos: lib.func('__stdcall', 'SetWindowPos', 'bool', [
        'uint64',
        'int64',
        'int',
        'int',
        'int',
        'int',
        'uint'
      ])
    }
    return cached
  } catch {
    return null
  }
}

/**
 * Asks DWM to render Win11 rounded corners on a window. Fully native — the
 * compositor draws and antialiases the rounding and keeps the matching shadow,
 * so it's identical to a normal app window. A no-op on older Windows or when DWM
 * declines (it won't clip transparent/layered windows). DWM only rounds restored
 * windows, so this self-squares when maximized/fullscreen.
 */
export function enableRoundedCorners(hwnd: bigint): void {
  const api = dwmapi()
  if (!api) return
  const pref = Buffer.alloc(4)
  pref.writeInt32LE(DWMWCP_ROUND, 0)
  api.DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, pref, 4)
}

/** Finds a direct child window of `parent` by window class name, or null. */
export function findChildWindowByClass(parent: bigint, className: string): bigint | null {
  const api = user32()
  if (!api) return null
  const hwnd = BigInt(api.FindWindowExW(parent, 0n, className, null))
  return hwnd === 0n ? null : hwnd
}

/** Raises a window to the top of its sibling z-order without moving/activating it. */
export function raiseWindowToTop(hwnd: bigint): void {
  const api = user32()
  if (!api) return
  api.SetWindowPos(hwnd, HWND_TOP, 0, 0, 0, 0, RAISE_FLAGS)
}

/**
 * Moves+sizes a window to the given client-area rectangle and raises it to the
 * top, in one call. Used to confine the embedded mpv video to the on-screen
 * region not covered by the title bar / transport bar (physical pixels).
 */
export function placeWindowOnTop(
  hwnd: bigint,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const api = user32()
  if (!api) return
  api.SetWindowPos(hwnd, HWND_TOP, x, y, width, height, SWP_NOACTIVATE)
}
