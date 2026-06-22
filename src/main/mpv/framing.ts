import type { MpvMessage } from './protocol'

/**
 * Decodes mpv's newline-delimited JSON stream into discrete messages.
 *
 * Socket reads arrive in arbitrary chunks that may split a JSON line in half
 * or carry several lines at once. This decoder buffers partial input and emits
 * one parsed object per complete `\n`-terminated line. It is deliberately pure
 * and side-effect free (no socket, no events) so the framing logic is fully
 * unit-testable.
 *
 * Malformed lines are reported via the `onError` hook and skipped rather than
 * throwing, so a single bad line never tears down the connection.
 */
export class JsonLineDecoder {
  private buffer = ''

  constructor(private readonly onError?: (line: string, error: unknown) => void) {}

  /** Feed a chunk; returns every complete message decoded from it. */
  push(chunk: string): MpvMessage[] {
    this.buffer += chunk

    const messages: MpvMessage[] = []
    let newlineIndex = this.buffer.indexOf('\n')

    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (line.length > 0) {
        const parsed = this.parseLine(line)
        if (parsed) messages.push(parsed)
      }

      newlineIndex = this.buffer.indexOf('\n')
    }

    return messages
  }

  private parseLine(line: string): MpvMessage | null {
    try {
      return JSON.parse(line) as MpvMessage
    } catch (error) {
      this.onError?.(line, error)
      return null
    }
  }
}
