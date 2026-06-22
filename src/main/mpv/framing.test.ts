import { describe, it, expect, vi } from 'vitest'
import { JsonLineDecoder } from './framing'

describe('JsonLineDecoder', () => {
  it('decodes a single complete line', () => {
    const decoder = new JsonLineDecoder()
    const messages = decoder.push('{"error":"success","request_id":1}\n')
    expect(messages).toEqual([{ error: 'success', request_id: 1 }])
  })

  it('decodes multiple messages in one chunk', () => {
    const decoder = new JsonLineDecoder()
    const messages = decoder.push(
      '{"event":"file-loaded"}\n{"error":"success","request_id":2}\n'
    )
    expect(messages).toHaveLength(2)
    expect(messages[0]).toEqual({ event: 'file-loaded' })
    expect(messages[1]).toEqual({ error: 'success', request_id: 2 })
  })

  it('buffers a line split across two chunks', () => {
    const decoder = new JsonLineDecoder()
    expect(decoder.push('{"error":"suc')).toEqual([])
    expect(decoder.push('cess","request_id":3}\n')).toEqual([
      { error: 'success', request_id: 3 }
    ])
  })

  it('holds a trailing partial line until its newline arrives', () => {
    const decoder = new JsonLineDecoder()
    expect(decoder.push('{"event":"seek"}\n{"event":"pa')).toEqual([{ event: 'seek' }])
    expect(decoder.push('use"}\n')).toEqual([{ event: 'pause' }])
  })

  it('ignores blank lines', () => {
    const decoder = new JsonLineDecoder()
    expect(decoder.push('\n\n{"event":"idle"}\n\n')).toEqual([{ event: 'idle' }])
  })

  it('reports malformed lines via onError and skips them without throwing', () => {
    const onError = vi.fn()
    const decoder = new JsonLineDecoder(onError)
    const messages = decoder.push('not-json\n{"event":"ok"}\n')
    expect(messages).toEqual([{ event: 'ok' }])
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0]).toBe('not-json')
  })
})
