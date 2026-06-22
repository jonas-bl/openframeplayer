import { EventEmitter } from 'node:events'
import type { MpvIpcClient } from './MpvIpcClient'
import { isPropertyChange, type MpvEvent, type MpvScalar } from './protocol'

/** A property change pushed by mpv after `observeProperty`. */
export interface PropertyChange {
  name: string
  value: unknown
}

/**
 * High-level, intent-revealing API over the raw IPC transport.
 *
 * This is the only surface the rest of the main process uses to talk to mpv:
 * read/write properties, run commands, and observe properties. It maps mpv's
 * numeric observe ids back to property names so callers deal purely in names.
 *
 * Emits:
 *   - `'property-change'` (PropertyChange) for observed properties
 *   - `'event'` (MpvEvent) for non-property events (file-loaded, end-file, ...)
 */
export class MpvController extends EventEmitter {
  private readonly observeIdToName = new Map<number, string>()
  private nextObserveId = 1

  constructor(private readonly ipc: MpvIpcClient) {
    super()
    this.ipc.on('event', (event: MpvEvent) => this.routeEvent(event))
  }

  /** Sets an mpv property (e.g. `pause`, `brightness`, `video-zoom`). */
  async setProperty(name: string, value: MpvScalar): Promise<void> {
    await this.ipc.send(['set_property', name, value])
  }

  /** Reads an mpv property's current value. */
  async getProperty<T = unknown>(name: string): Promise<T> {
    const response = await this.ipc.send(['get_property', name])
    return response.data as T
  }

  /** Runs an arbitrary mpv command (e.g. `['frame-step']`, `['loadfile', path]`). */
  async command(args: MpvScalar[]): Promise<unknown> {
    const response = await this.ipc.send(args)
    return response.data
  }

  /** Loads a file, replacing any current playback. */
  async loadFile(path: string): Promise<void> {
    await this.command(['loadfile', path, 'replace'])
  }

  /**
   * Resolves when mpv next reports `file-loaded` (or after `timeoutMs`, so a
   * caller can never hang). `loadfile` only resolves on command-ack, well before
   * the file is actually decodable — until then properties like `time-pos` come
   * back as "unavailable" (the IPC rejects). Awaiting this after a `loadfile`
   * lets callers read a settled position; the timeout is a safety valve.
   */
  waitForFileLoaded(timeoutMs = 2000): Promise<void> {
    return new Promise<void>((resolve) => {
      const finish = (): void => {
        clearTimeout(timer)
        this.off('event', onEvent)
        resolve()
      }
      const onEvent = (event: MpvEvent): void => {
        if (event.event === 'file-loaded') finish()
      }
      const timer = setTimeout(finish, timeoutMs)
      this.on('event', onEvent)
    })
  }

  /**
   * Subscribes to change notifications for a property. Returned changes arrive
   * via the `'property-change'` event. mpv also fires once immediately with the
   * current value.
   */
  async observeProperty(name: string): Promise<void> {
    const id = this.nextObserveId++
    this.observeIdToName.set(id, name)
    await this.ipc.send(['observe_property', id, name])
  }

  /** Observes several properties in one call. */
  async observeProperties(names: string[]): Promise<void> {
    for (const name of names) await this.observeProperty(name)
  }

  private routeEvent(event: MpvEvent): void {
    if (isPropertyChange(event)) {
      this.emit('property-change', { name: event.name, value: event.data })
    } else {
      this.emit('event', event)
    }
  }
}
