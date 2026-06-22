import { EventEmitter } from 'node:events'
import { connect, type Socket } from 'node:net'
import { JsonLineDecoder } from './framing'
import {
  isMpvEvent,
  isMpvResponse,
  type MpvEvent,
  type MpvResponse,
  type MpvScalar
} from './protocol'

interface PendingRequest {
  resolve: (response: MpvResponse) => void
  reject: (error: Error) => void
}

export interface MpvIpcClientOptions {
  /** How long to keep retrying the initial connect (ms). */
  connectTimeoutMs?: number
  /** Delay between connect attempts (ms). */
  connectRetryMs?: number
}

/**
 * Low-level mpv JSON-IPC transport over a single socket / named pipe.
 *
 * Responsibilities are narrow on purpose: connect (with retry, since the pipe
 * appears slightly after mpv spawns), frame the byte stream into messages,
 * correlate command responses by `request_id`, and surface mpv events. Higher
 * level semantics (properties, observers) live in {@link MpvController}.
 *
 * Emits:
 *   - `'event'` (MpvEvent) for every mpv event
 *   - `'close'` when the socket ends
 *   - `'error'` (Error) on transport errors
 */
export class MpvIpcClient extends EventEmitter {
  private socket: Socket | null = null
  private readonly decoder: JsonLineDecoder
  private readonly pending = new Map<number, PendingRequest>()
  private nextRequestId = 1
  private disposed = false

  constructor(
    private readonly socketPath: string,
    private readonly options: MpvIpcClientOptions = {}
  ) {
    super()
    this.decoder = new JsonLineDecoder((line, error) =>
      this.emit('error', new Error(`Failed to parse mpv line: ${line} (${String(error)})`))
    )
  }

  /** Connects to the socket, retrying until available or the timeout elapses. */
  connect(): Promise<void> {
    const timeoutMs = this.options.connectTimeoutMs ?? 5000
    const retryMs = this.options.connectRetryMs ?? 50
    const deadline = Date.now() + timeoutMs

    return new Promise<void>((resolve, reject) => {
      const attempt = (): void => {
        if (this.disposed) {
          reject(new Error('MpvIpcClient disposed before connecting'))
          return
        }

        const socket = connect(this.socketPath)

        socket.once('connect', () => {
          this.attachSocket(socket)
          resolve()
        })

        socket.once('error', (err) => {
          socket.destroy()
          if (Date.now() >= deadline) {
            reject(new Error(`Could not connect to mpv IPC at ${this.socketPath}: ${err.message}`))
          } else {
            setTimeout(attempt, retryMs)
          }
        })
      }

      attempt()
    })
  }

  private attachSocket(socket: Socket): void {
    this.socket = socket
    socket.setEncoding('utf8')

    socket.on('data', (chunk: string) => this.handleData(chunk))
    socket.on('close', () => {
      this.failAllPending(new Error('mpv IPC connection closed'))
      this.emit('close')
    })
    socket.on('error', (err) => this.emit('error', err))
  }

  private handleData(chunk: string): void {
    for (const message of this.decoder.push(chunk)) {
      if (isMpvResponse(message)) {
        this.resolvePending(message)
      } else if (isMpvEvent(message)) {
        this.emit('event', message as MpvEvent)
      }
    }
  }

  private resolvePending(response: MpvResponse): void {
    const request = this.pending.get(response.request_id)
    if (!request) return
    this.pending.delete(response.request_id)
    request.resolve(response)
  }

  /**
   * Sends a command and resolves with mpv's response. Rejects if the socket is
   * not connected or mpv reports an error.
   */
  send(command: MpvScalar[]): Promise<MpvResponse> {
    if (!this.socket || this.socket.destroyed) {
      return Promise.reject(new Error('mpv IPC not connected'))
    }

    const requestId = this.nextRequestId++
    const payload = JSON.stringify({ command, request_id: requestId }) + '\n'

    return new Promise<MpvResponse>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (response) => {
          if (response.error === 'success') resolve(response)
          else reject(new Error(`mpv command failed (${response.error}): ${command.join(' ')}`))
        },
        reject
      })
      this.socket!.write(payload, (err) => {
        if (err) {
          this.pending.delete(requestId)
          reject(err)
        }
      })
    })
  }

  private failAllPending(error: Error): void {
    for (const request of this.pending.values()) request.reject(error)
    this.pending.clear()
  }

  dispose(): void {
    this.disposed = true
    this.failAllPending(new Error('mpv IPC disposed'))
    this.socket?.destroy()
    this.socket = null
    this.removeAllListeners()
  }
}
