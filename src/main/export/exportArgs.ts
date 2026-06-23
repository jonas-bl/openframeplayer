import { basename, extname } from 'node:path'
import type { ExportFormat } from '@shared/ipc'

export type { ExportFormat }

/** Inputs for {@link buildExportArgs}. */
export interface ExportArgsOptions {
  inputPath: string
  /** Output file (mp4/gif) or output directory (pngseq). */
  output: string
  startSeconds: number
  endSeconds: number
  format: ExportFormat
  /** GIF frame rate (default 15). */
  gifFps?: number
  /** GIF width in px; height auto-scales to keep the aspect (default 480). */
  gifWidth?: number
}

const DEFAULT_GIF_FPS = 15
const DEFAULT_GIF_WIDTH = 480

/**
 * mpv command-line args that export the `[start, end]` segment of `inputPath`.
 *
 * Clips and GIFs use mpv's headless **encode mode** (`--o=`), exactly like the
 * loop proxy — no separate ffmpeg dependency. PNG sequences instead drive the
 * image video-output (`--vo=image`) untimed (as fast as it decodes) so every
 * frame in the range is written to `--vo-image-outdir`. All three trim the
 * source with `--start`/`--end` (seconds), so only the chosen range is decoded.
 */
export function buildExportArgs(o: ExportArgsOptions): string[] {
  const base = [
    o.inputPath,
    '--no-config',
    '--no-terminal',
    '--msg-level=all=no',
    `--start=${o.startSeconds}`,
    `--end=${o.endSeconds}`
  ]

  switch (o.format) {
    case 'mp4':
      return [
        ...base,
        '--ovc=libx264',
        '--ovcopts=preset=medium,crf=18',
        '--oac=aac',
        '--of=mp4',
        `--o=${o.output}`
      ]
    case 'gif': {
      const fps = o.gifFps ?? DEFAULT_GIF_FPS
      const width = o.gifWidth ?? DEFAULT_GIF_WIDTH
      return [
        ...base,
        '--no-audio',
        `--vf=fps=${fps},scale=${width}:-1:flags=lanczos`,
        '--ovc=gif',
        '--of=gif',
        `--o=${o.output}`
      ]
    }
    case 'pngseq':
      return [
        ...base,
        '--no-audio',
        '--untimed',
        '--vo=image',
        '--vo-image-format=png',
        `--vo-image-outdir=${o.output}`
      ]
  }
}

/** Pads a number to two digits for timestamp components. */
const pad = (n: number): string => n.toString().padStart(2, '0')

/** `20260620-160501`-style stamp, filesystem-safe and sortable. */
function timestamp(date: Date): string {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${d}-${t}`
}

/**
 * A descriptive default name for an export:
 *   `<source>_f<start>-<end>_<timestamp>.<ext>`
 *
 * For a PNG sequence there's no file extension — the name is used for the output
 * folder. Pure aside from the injected `date`, so it's testable. The frame range
 * ties each export to the exact frames it covers (this is a frame-accurate tool).
 */
export function buildExportName(
  sourcePath: string | null,
  format: ExportFormat,
  startFrame: number,
  endFrame: number,
  date: Date = new Date()
): string {
  const source = sourcePath ? basename(sourcePath, extname(sourcePath)) : 'clip'
  const safe = source.replace(/[^\w.-]+/g, '_')
  const range = `f${Math.max(0, Math.round(startFrame))}-${Math.max(0, Math.round(endFrame))}`
  const stem = `${safe}_${range}_${timestamp(date)}`
  const ext = format === 'mp4' ? '.mp4' : format === 'gif' ? '.gif' : ''
  return `${stem}${ext}`
}
