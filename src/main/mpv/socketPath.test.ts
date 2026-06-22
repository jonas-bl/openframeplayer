import { describe, it, expect } from 'vitest'
import { createIpcSocketPath, createMpvInstanceId } from './socketPath'

describe('createIpcSocketPath', () => {
  it('builds a Windows named pipe', () => {
    expect(createIpcSocketPath('mpv-test', 'win32')).toBe('\\\\.\\pipe\\mpv-test')
  })

  it('builds a Unix domain socket under the temp dir', () => {
    const path = createIpcSocketPath('mpv-test', 'linux')
    expect(path).toMatch(/mpv-test\.sock$/)
    expect(path).not.toContain('pipe')
  })
})

describe('createMpvInstanceId', () => {
  it('is prefixed and unique-ish per call', () => {
    const a = createMpvInstanceId()
    const b = createMpvInstanceId()
    expect(a).toMatch(/^mpv-frameplayer-/)
    expect(a).not.toBe(b)
  })
})
