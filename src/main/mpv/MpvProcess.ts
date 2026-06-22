import { EventEmitter } from 'node:events'
import { spawn, type ChildProcess } from 'node:child_process'

/**
 * Owns the mpv child process lifecycle: spawn it with the given binary and
 * args, surface unexpected exits, and shut it down cleanly.
 *
 * Kept separate from the IPC transport so each side can be reasoned about and
 * replaced independently (e.g. a future libmpv-embed backend would swap this
 * out without touching {@link MpvIpcClient}).
 *
 * Emits:
 *   - `'exit'` (code: number | null) when mpv terminates
 *   - `'error'` (Error) if mpv fails to spawn
 */
export class MpvProcess extends EventEmitter {
  private child: ChildProcess | null = null

  constructor(
    private readonly binaryPath: string,
    private readonly args: string[]
  ) {
    super()
  }

  start(): void {
    if (this.child) throw new Error('mpv process already started')

    const child = spawn(this.binaryPath, this.args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.on('error', (err) => this.emit('error', err))
    child.on('exit', (code) => {
      this.child = null
      this.emit('exit', code)
    })

    this.child = child
  }

  get pid(): number | undefined {
    return this.child?.pid
  }

  get isRunning(): boolean {
    return this.child !== null
  }

  /** Terminates mpv. Safe to call when not running. */
  stop(): void {
    if (!this.child) return
    this.child.kill()
    this.child = null
  }
}
