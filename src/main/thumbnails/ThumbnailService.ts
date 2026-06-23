import { execFile } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import type { ThumbnailSheet } from '@shared/ipc'

const COLS = 10
const ROWS = 10
const CELL_W = 160
const CELL_H = 90
const CELLS = COLS * ROWS
/** mpv seek-step thumbnailing is fast, but cap the run so a stuck decode can't hang. */
const TIMEOUT_MS = 60_000

/**
 * Builds seek-bar preview sprite sheets with the bundled mpv. One headless mpv
 * run uses `--sstep` (seek-step) to jump through the file — keyframe seeks, not
 * a full decode — scaling each sampled frame and packing them into a single
 * tiled JPEG via the `tile` video filter. Results are cached per path (so the
 * generation runs at most once per file) and returned as a data URL.
 *
 * App-global and Electron-free apart from the mpv binary path; degrades to
 * `null` whenever mpv is missing or generation fails (the seek bar just shows no
 * preview).
 */
export class ThumbnailService {
  private readonly cache = new Map<string, Promise<ThumbnailSheet | null>>()

  constructor(
    private readonly mpvBinaryPath: string | null,
    private readonly tempDir: () => string
  ) {}

  /** The sheet for `path` (built on first request, then cached), or null. */
  get(path: string, duration: number): Promise<ThumbnailSheet | null> {
    const cached = this.cache.get(path)
    if (cached) return cached
    const pending = this.generate(path, duration).catch(() => null)
    this.cache.set(path, pending)
    return pending
  }

  private generate(path: string, duration: number): Promise<ThumbnailSheet | null> {
    if (!this.mpvBinaryPath || !(duration > 0)) return Promise.resolve(null)

    const step = Math.max(0.04, duration / CELLS)
    const id = `fp-thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const outDir = join(this.tempDir(), id)
    try {
      mkdirSync(outDir, { recursive: true })
    } catch {
      return Promise.resolve(null)
    }

    const args = [
      '--no-config',
      '--really-quiet',
      '--no-audio',
      `--sstep=${step}`,
      `--vf=scale=${CELL_W}:${CELL_H},tile=${COLS}x${ROWS}`,
      '--vo=image',
      '--vo-image-format=jpg',
      '--vo-image-jpeg-quality=80',
      `--vo-image-outdir=${outDir}`,
      path
    ]

    return new Promise((resolve) => {
      execFile(this.mpvBinaryPath as string, args, { timeout: TIMEOUT_MS, windowsHide: true }, () => {
        // The tile filter emits the full sheet first (and possibly a small
        // partial sheet at EOF); the first file written is the complete grid.
        let sheet: ThumbnailSheet | null = null
        try {
          const files = readdirSync(outDir).sort()
          if (files.length > 0) {
            const bytes = readFileSync(join(outDir, files[0]))
            sheet = {
              dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
              cols: COLS,
              rows: ROWS,
              count: CELLS,
              cellWidth: CELL_W,
              cellHeight: CELL_H
            }
          }
        } catch {
          /* leave sheet null */
        }
        rmSync(outDir, { recursive: true, force: true })
        resolve(sheet)
      })
    })
  }
}
