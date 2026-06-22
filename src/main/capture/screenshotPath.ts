import { join, basename, extname } from 'node:path'

/** Pads a number to two digits for timestamp components. */
const pad = (n: number): string => n.toString().padStart(2, '0')

/** `20260620-160501`-style stamp, filesystem-safe and sortable. */
function timestamp(date: Date): string {
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
  const t = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${d}-${t}`
}

/**
 * Builds a descriptive, collision-resistant screenshot file path:
 *   `<dir>/<source>_f<frame>_<timestamp>.png`
 *
 * Pure aside from the injected `date` (defaulted), so the naming is testable.
 * The frame number ties each capture to the exact frame it came from — central
 * to a frame-accurate review tool.
 */
export function buildScreenshotPath(
  outputDir: string,
  sourcePath: string | null,
  frame: number,
  date: Date = new Date()
): string {
  const source = sourcePath ? basename(sourcePath, extname(sourcePath)) : 'capture'
  const safeSource = source.replace(/[^\w.-]+/g, '_')
  const fileName = `${safeSource}_f${Math.max(0, Math.round(frame))}_${timestamp(date)}.png`
  return join(outputDir, fileName)
}
