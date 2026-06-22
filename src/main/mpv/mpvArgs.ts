/**
 * Builds the mpv command-line arguments.
 *
 * Centralised so playback/quality policy lives in exactly one place. The
 * defaults encode the briefing's hard requirements:
 *   - GPU decoding (`hwdec=auto-safe`) so 4K plays back smoothly
 *   - high-quality GPU rendering/scaling (`profile=gpu-hq`, `vo=gpu-next`)
 *   - no built-in OSD/OSC — the React UI draws every control itself
 *   - idle + keep-open so the window persists with no file and at EOF
 *   - lossless PNG screenshots taken from decoded video pixels
 */
import { DEFAULT_HWDEC } from './mpvProperties'

export interface MpvArgsOptions {
  /** IPC endpoint mpv should listen on (named pipe / socket path). */
  ipcSocketPath: string
  /** Native window handle to embed into (Electron HWND on Windows). */
  windowId?: number | bigint
  /** Directory screenshots are written to. */
  screenshotDir?: string
}

export function buildMpvArgs(options: MpvArgsOptions): string[] {
  const { ipcSocketPath, windowId, screenshotDir } = options

  const args = [
    `--input-ipc-server=${ipcSocketPath}`,

    // No standalone window / no auto-exit: we host and control mpv.
    '--idle=yes',
    '--force-window=no',
    '--keep-open=yes',
    '--no-config',

    // Our React layer owns all on-screen UI.
    '--no-osc',
    '--osd-level=0',
    '--no-input-default-bindings',
    '--input-vo-keyboard=no',
    '--cursor-autohide=no',

    // Quality + performance: GPU decode and high-quality GPU rendering.
    '--vo=gpu-next',
    `--hwdec=${DEFAULT_HWDEC}`,
    '--profile=gpu-hq',
    '--video-sync=audio',

    // Generous demuxer cache with a back buffer so frame-back-stepping and
    // backward scrubbing can replay recently decoded packets without re-reading
    // from disk. Reverse playback is driven by stepping frames backward (see
    // ReverseDriver), not mpv's native backward decode, so no reversal buffers
    // or decode-ahead queues are needed.
    '--demuxer-max-bytes=512MiB',
    '--demuxer-max-back-bytes=512MiB',

    // Frame-accurate, lossless PNG screenshots from decoded video pixels.
    '--screenshot-format=png',
    '--screenshot-png-compression=0',

    // Start paused and idle until the UI loads a file.
    '--pause'
  ]

  if (screenshotDir) {
    args.push(`--screenshot-directory=${screenshotDir}`)
  }

  if (windowId !== undefined) {
    args.push(`--wid=${windowId.toString()}`)
  }

  return args
}
