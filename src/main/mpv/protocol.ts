/**
 * Types and guards for mpv's JSON IPC protocol.
 *
 * mpv exposes a line-delimited JSON protocol over a socket (a named pipe on
 * Windows). Each message we send is a command object with a `request_id`; mpv
 * replies with a matching response, and separately emits event objects (e.g.
 * `property-change` after `observe_property`).
 *
 * Reference: https://mpv.io/manual/master/#json-ipc
 */

/** A scalar mpv accepts as a command argument or property value. */
export type MpvScalar = string | number | boolean

/** A command sent to mpv, e.g. `{ command: ['set_property', 'pause', true] }`. */
export interface MpvCommandRequest {
  command: MpvScalar[]
  request_id: number
  /** When true, mpv runs the command asynchronously (we rarely need this). */
  async?: boolean
}

/** mpv's reply to a command. `error` is `'success'` on success. */
export interface MpvResponse {
  request_id: number
  error: string
  data?: unknown
}

/** Emitted continuously for each observed property after `observe_property`. */
export interface MpvPropertyChangeEvent {
  event: 'property-change'
  id: number
  name: string
  data: unknown
}

/** Any other mpv event (`file-loaded`, `end-file`, `seek`, ...). */
export interface MpvGenericEvent {
  event: string
  [key: string]: unknown
}

export type MpvEvent = MpvPropertyChangeEvent | MpvGenericEvent

/** Anything mpv can send us on the socket. */
export type MpvMessage = MpvResponse | MpvEvent

export function isMpvResponse(message: MpvMessage): message is MpvResponse {
  return typeof (message as MpvResponse).request_id === 'number'
}

export function isMpvEvent(message: MpvMessage): message is MpvEvent {
  return typeof (message as MpvEvent).event === 'string'
}

export function isPropertyChange(event: MpvEvent): event is MpvPropertyChangeEvent {
  return event.event === 'property-change'
}

/** True when an mpv response reports success. */
export function isSuccess(response: MpvResponse): boolean {
  return response.error === 'success'
}
