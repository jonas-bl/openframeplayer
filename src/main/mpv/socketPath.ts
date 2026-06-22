import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Builds the platform-specific IPC endpoint mpv listens on (passed to mpv via
 * `--input-ipc-server` and to `net.connect` on our side).
 *
 * Abstracting this from day one — even though Windows is the only current
 * target — keeps the eventual macOS/Linux port a one-branch change rather than
 * a hunt through the codebase, as the briefing requires.
 *
 * - Windows: a named pipe `\\.\pipe\<id>`
 * - Unix: a domain socket file under the OS temp dir
 */
export function createIpcSocketPath(
  id: string,
  platform: NodeJS.Platform = process.platform
): string {
  if (platform === 'win32') {
    return `\\\\.\\pipe\\${id}`
  }
  return join(tmpdir(), `${id}.sock`)
}

/** A unique IPC id for one mpv instance (pid + time + random, collision-safe). */
export function createMpvInstanceId(): string {
  const random = Math.random().toString(36).slice(2, 8)
  return `mpv-frameplayer-${process.pid}-${Date.now().toString(36)}-${random}`
}
