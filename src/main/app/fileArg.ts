import { existsSync, statSync } from 'node:fs'

/**
 * Extracts a media file path from process argv.
 *
 * When the OS launches the app via "Open with FramePlayer" / a file
 * association, the file is appended to argv. We scan from the end for the first
 * entry that is an existing file (skipping the executable, flags, and the dev
 * `.` / app-path entries, which are not files). Pure — the file check is
 * injected — so it is unit-tested without touching disk.
 */
export function extractFileArg(argv: string[], isFile: (path: string) => boolean): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i]
    if (!arg || arg.startsWith('-') || arg === '.') continue
    if (isFile(arg)) return arg
  }
  return null
}

/** Production wrapper: checks the real filesystem. */
export function fileFromArgv(argv: string[]): string | null {
  return extractFileArg(argv, (p) => {
    try {
      return existsSync(p) && statSync(p).isFile()
    } catch {
      return false
    }
  })
}
