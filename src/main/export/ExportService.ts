import { spawn, type ChildProcess } from 'node:child_process'
import { buildExportArgs, type ExportArgsOptions } from './exportArgs'

export interface ExportServiceDeps {
  /** Bundled mpv binary, used headless to encode/dump frames; null disables export. */
  mpvBinaryPath: string | null
}

/**
 * Runs range exports (clip / GIF / PNG sequence) by spawning mpv headless, the
 * same encode path the loop proxy uses — so there's no extra ffmpeg dependency.
 *
 * One export at a time: spawning a second while one runs rejects (the UI keeps a
 * single export toast). IO-only orchestration, so it isn't unit-tested; the
 * arg-building it relies on lives in {@link buildExportArgs} and is.
 */
export class ExportService {
  private job: ChildProcess | null = null

  constructor(private readonly deps: ExportServiceDeps) {}

  get isBusy(): boolean {
    return this.job !== null
  }

  /** Runs one export to completion. Rejects on failure, busy, or no mpv binary. */
  run(opts: ExportArgsOptions): Promise<void> {
    if (!this.deps.mpvBinaryPath) return Promise.reject(new Error('mpv is unavailable'))
    if (this.job) return Promise.reject(new Error('An export is already running'))

    const args = buildExportArgs(opts)
    return new Promise((resolve, reject) => {
      const child = spawn(this.deps.mpvBinaryPath as string, args, {
        windowsHide: true,
        stdio: 'ignore'
      })
      this.job = child
      child.on('error', (err) => {
        if (this.job === child) this.job = null
        reject(err)
      })
      child.on('exit', (code) => {
        if (this.job === child) this.job = null
        if (code === 0) resolve()
        else reject(new Error(`Export failed (mpv exited with code ${code ?? 'unknown'})`))
      })
    })
  }

  /** Cancels any in-flight export. */
  cancel(): void {
    if (this.job) {
      this.job.kill()
      this.job = null
    }
  }

  dispose(): void {
    this.cancel()
  }
}
