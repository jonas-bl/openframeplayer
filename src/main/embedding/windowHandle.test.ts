import { describe, it, expect } from 'vitest'
import { bufferToWindowId } from './windowHandle'

describe('bufferToWindowId', () => {
  it('reads an 8-byte little-endian x64 handle', () => {
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64LE(0x1234_5678n, 0)
    expect(bufferToWindowId(buf)).toBe(0x1234_5678n)
  })

  it('reads a 4-byte little-endian x86 handle', () => {
    const buf = Buffer.alloc(4)
    buf.writeUInt32LE(0x00ab_cdef, 0)
    expect(bufferToWindowId(buf)).toBe(0x00ab_cdefn)
  })

  it('handles large 64-bit handles beyond MAX_SAFE_INTEGER', () => {
    const buf = Buffer.alloc(8)
    const big = 0x7fff_ffff_ffff_0000n
    buf.writeBigUInt64LE(big, 0)
    expect(bufferToWindowId(buf)).toBe(big)
  })

  it('throws on an unexpectedly small buffer', () => {
    expect(() => bufferToWindowId(Buffer.alloc(2))).toThrow(/handle size/)
  })
})
