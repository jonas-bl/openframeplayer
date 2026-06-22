import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { resolveMpvPath, type LocateMpvOptions } from './locateMpv'

/** Builds options with a fake filesystem that only "contains" `present`. */
function options(overrides: Partial<LocateMpvOptions> & { present: string[] }): LocateMpvOptions {
  const present = new Set(overrides.present)
  return {
    platform: 'win32',
    env: {},
    bundledDir: 'C:\\app\\resources\\mpv',
    fileExists: (candidate) => present.has(candidate),
    ...overrides
  }
}

describe('resolveMpvPath (win32)', () => {
  it('prefers the MPV_PATH override when it exists', () => {
    const result = resolveMpvPath(
      options({
        env: { MPV_PATH: 'C:\\custom\\mpv.exe', PATH: 'C:\\app\\resources\\mpv' },
        present: ['C:\\custom\\mpv.exe', 'C:\\app\\resources\\mpv\\mpv.exe']
      })
    )
    expect(result).toBe('C:\\custom\\mpv.exe')
  })

  it('falls back to the bundled binary when no override', () => {
    const result = resolveMpvPath(
      options({ present: ['C:\\app\\resources\\mpv\\mpv.exe'] })
    )
    expect(result).toBe('C:\\app\\resources\\mpv\\mpv.exe')
  })

  it('finds mpv on PATH when not bundled', () => {
    const result = resolveMpvPath(
      options({
        env: { PATH: 'C:\\tools;C:\\bin' },
        present: ['C:\\bin\\mpv.exe']
      })
    )
    expect(result).toBe('C:\\bin\\mpv.exe')
  })

  it('checks common install locations last', () => {
    const result = resolveMpvPath(
      options({
        env: { ProgramFiles: 'C:\\Program Files' },
        present: ['C:\\Program Files\\mpv\\mpv.exe']
      })
    )
    expect(result).toBe('C:\\Program Files\\mpv\\mpv.exe')
  })

  it('returns null when mpv is nowhere to be found', () => {
    expect(resolveMpvPath(options({ present: [] }))).toBeNull()
  })

  it('ignores an MPV_PATH override that does not exist', () => {
    const result = resolveMpvPath(
      options({
        env: { MPV_PATH: 'C:\\nope\\mpv.exe' },
        present: ['C:\\app\\resources\\mpv\\mpv.exe']
      })
    )
    expect(result).toBe('C:\\app\\resources\\mpv\\mpv.exe')
  })
})

describe('resolveMpvPath (linux)', () => {
  it('uses the unix binary name (mpv, not mpv.exe) and common dirs', () => {
    // Use join() for the expected value so the assertion is independent of the
    // host path separator the tests happen to run on.
    const expected = join('/usr/bin', 'mpv')
    const result = resolveMpvPath({
      platform: 'linux',
      env: {},
      bundledDir: '/app/resources/mpv',
      fileExists: (candidate) => candidate === expected
    })
    expect(result).toBe(expected)
  })
})
