import { join, delimiter } from 'node:path'
import { existsSync } from 'node:fs'

/**
 * Inputs for {@link resolveMpvPath}. Everything the function touches is passed
 * in (no direct `process`/`fs` access) so resolution order can be unit-tested
 * deterministically without a real filesystem.
 */
export interface LocateMpvOptions {
  platform: NodeJS.Platform
  /** Environment map; `MPV_PATH` (explicit override) and `PATH` are consulted. */
  env: Record<string, string | undefined>
  /** Directory holding the bundled mpv (resources/mpv in dev or packaged). */
  bundledDir: string
  /** Predicate used to test candidate paths — injectable for tests. */
  fileExists: (candidate: string) => boolean
}

/** Executable name for the current platform. */
function mpvBinaryName(platform: NodeJS.Platform): string {
  return platform === 'win32' ? 'mpv.exe' : 'mpv'
}

/**
 * Common locations mpv is installed to, checked after the bundle and PATH.
 * Windows-first; Unix entries keep a later port honest.
 */
function commonInstallDirs(platform: NodeJS.Platform, env: LocateMpvOptions['env']): string[] {
  if (platform === 'win32') {
    const programFiles = env['ProgramFiles'] ?? 'C:\\Program Files'
    const localAppData = env['LOCALAPPDATA'] ?? ''
    return [
      join(programFiles, 'mpv'),
      'C:\\ProgramData\\chocolatey\\bin',
      localAppData ? join(localAppData, 'Microsoft', 'WinGet', 'Links') : '',
      localAppData ? join(localAppData, 'scoop', 'shims') : ''
    ].filter(Boolean)
  }
  return ['/usr/local/bin', '/usr/bin', '/opt/homebrew/bin']
}

/**
 * Resolves the mpv executable using this precedence:
 *   1. `MPV_PATH` env override (used verbatim if it exists)
 *   2. the bundled binary under `bundledDir`
 *   3. each directory on `PATH`
 *   4. common per-platform install locations
 *
 * Returns the first existing candidate, or `null` if mpv cannot be found.
 */
export function resolveMpvPath(options: LocateMpvOptions): string | null {
  const { platform, env, bundledDir, fileExists } = options
  const binary = mpvBinaryName(platform)

  const override = env['MPV_PATH']
  if (override && fileExists(override)) return override

  const searchDirs = [
    bundledDir,
    ...(env['PATH'] ?? '').split(delimiter).filter(Boolean),
    ...commonInstallDirs(platform, env)
  ]

  for (const dir of searchDirs) {
    const candidate = join(dir, binary)
    if (fileExists(candidate)) return candidate
  }

  return null
}

/**
 * Production wrapper: resolves the bundled directory from Electron packaging
 * state and delegates to the pure {@link resolveMpvPath}.
 *
 * @param resourcesDir - `app.isPackaged ? process.resourcesPath : <repo>/resources`
 */
export function locateMpv(resourcesDir: string): string | null {
  return resolveMpvPath({
    platform: process.platform,
    env: process.env,
    bundledDir: join(resourcesDir, 'mpv'),
    fileExists: existsSync
  })
}
