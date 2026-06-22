import { describe, it, expect } from 'vitest'
import { extractFileArg } from './fileArg'

describe('extractFileArg', () => {
  const files = new Set(['C:\\videos\\clip.mp4', '/home/u/a.mkv'])
  const isFile = (p: string): boolean => files.has(p)

  it('finds a file argument appended by the OS (packaged)', () => {
    expect(extractFileArg(['FramePlayer.exe', 'C:\\videos\\clip.mp4'], isFile)).toBe(
      'C:\\videos\\clip.mp4'
    )
  })

  it('skips the dev runner entries (electron, ".") and finds the file', () => {
    expect(extractFileArg(['electron.exe', '.', '/home/u/a.mkv'], isFile)).toBe('/home/u/a.mkv')
  })

  it('ignores flags', () => {
    expect(
      extractFileArg(['electron.exe', '--inspect', 'C:\\videos\\clip.mp4'], isFile)
    ).toBe('C:\\videos\\clip.mp4')
  })

  it('returns null when no file argument is present', () => {
    expect(extractFileArg(['FramePlayer.exe'], isFile)).toBeNull()
    expect(extractFileArg(['electron.exe', '.'], isFile)).toBeNull()
  })

  it('never returns the executable itself', () => {
    expect(extractFileArg(['C:\\videos\\clip.mp4'], isFile)).toBeNull() // argv[0] is skipped
  })
})
