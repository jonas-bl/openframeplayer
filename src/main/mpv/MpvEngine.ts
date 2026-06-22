import { EventEmitter } from 'node:events'
import { MpvProcess } from './MpvProcess'
import { MpvIpcClient } from './MpvIpcClient'
import { MpvController } from './MpvController'
import { buildMpvArgs } from './mpvArgs'
import { createIpcSocketPath, createMpvInstanceId } from './socketPath'

export interface MpvEngineOptions {
  /** Absolute path to a resolved mpv binary (see locateMpv). */
  binaryPath: string
  /** Directory lossless screenshots are written to. */
  screenshotDir?: string
}

/**
 * Orchestrates the full mpv backend lifecycle behind one object: build the IPC
 * endpoint, spawn the process, connect the transport, and expose a ready
 * {@link MpvController}.
 *
 * The bootstrap code only ever needs `start()`, `controller`, and `dispose()`;
 * the moving parts (process, socket, framing) stay encapsulated here.
 *
 * Emits:
 *   - `'ready'` once mpv is connected and controllable
 *   - `'exit'` (code) when mpv terminates unexpectedly
 *   - `'error'` (Error) on process or transport failure
 */
export class MpvEngine extends EventEmitter {
  private process: MpvProcess | null = null
  private ipc: MpvIpcClient | null = null
  private controllerInstance: MpvController | null = null
  private ready = false

  constructor(private readonly options: MpvEngineOptions) {
    super()
  }

  get isReady(): boolean {
    return this.ready
  }

  /** The controller used to drive mpv. Throws if accessed before `start()`. */
  get controller(): MpvController {
    if (!this.controllerInstance) throw new Error('mpv engine not started')
    return this.controllerInstance
  }

  /**
   * Spawns mpv and establishes the IPC connection.
   *
   * @param windowId - native window handle to embed into (`--wid`). Omit to run
   *                   headless during step-2 verification; pass it in step 3.
   */
  async start(windowId?: number | bigint): Promise<void> {
    const socketPath = createIpcSocketPath(createMpvInstanceId())
    const args = buildMpvArgs({
      ipcSocketPath: socketPath,
      windowId,
      screenshotDir: this.options.screenshotDir
    })

    this.process = new MpvProcess(this.options.binaryPath, args)
    this.process.on('error', (err) => this.emit('error', err))
    this.process.on('exit', (code) => {
      this.ready = false
      this.emit('exit', code)
    })
    this.process.start()

    this.ipc = new MpvIpcClient(socketPath)
    this.ipc.on('error', (err) => this.emit('error', err))
    await this.ipc.connect()

    this.controllerInstance = new MpvController(this.ipc)
    this.ready = true
    this.emit('ready')
  }

  dispose(): void {
    this.ready = false
    this.ipc?.dispose()
    this.process?.stop()
    this.ipc = null
    this.process = null
    this.controllerInstance = null
    this.removeAllListeners()
  }
}
