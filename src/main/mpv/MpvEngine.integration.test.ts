import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { MpvEngine } from './MpvEngine'
import { OBSERVED_PROPERTIES } from '../state/playerStateBindings'

/**
 * End-to-end verification of step 2: spawn the bundled mpv, connect over JSON
 * IPC, and prove property read/write + file loading work through the real
 * engine code. Auto-skips when the bundled mpv is absent (run `npm run
 * fetch:mpv`), so the default suite stays green on any machine.
 */
const mpvPath = join(process.cwd(), 'resources', 'mpv', 'mpv.exe')
const hasMpv = existsSync(mpvPath)

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Polls `read` until `accept` holds or the timeout elapses. Tolerant of
 * rejections (mpv reports "property unavailable" transiently right after a
 * load), treating them as "not ready yet" and continuing to poll.
 */
async function poll<T>(
  read: () => Promise<T>,
  accept: (value: T) => boolean,
  { timeoutMs = 6000, intervalMs = 100 } = {}
): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs
  let last: T | undefined
  for (;;) {
    try {
      last = await read()
      if (accept(last)) return last
    } catch {
      /* property not available yet — keep polling */
    }
    if (Date.now() >= deadline) return last
    await delay(intervalMs)
  }
}

describe.skipIf(!hasMpv)('MpvEngine integration (requires bundled mpv)', () => {
  let engine: MpvEngine

  beforeAll(async () => {
    engine = new MpvEngine({ binaryPath: mpvPath })
    await engine.start()
  }, 20000)

  afterAll(() => engine?.dispose())

  it('connects and reports ready', () => {
    expect(engine.isReady).toBe(true)
  })

  it('writes and reads back a property over IPC', async () => {
    await engine.controller.setProperty('brightness', 30)
    expect(await engine.controller.getProperty<number>('brightness')).toBe(30)

    await engine.controller.setProperty('brightness', -12)
    expect(await engine.controller.getProperty<number>('brightness')).toBe(-12)
  })

  it('loads a synthetic source (file-loaded) and exposes the decoded width', async () => {
    const fileLoaded = new Promise<void>((resolve) => {
      engine.controller.on('event', (e) => {
        if (e.event === 'file-loaded') resolve()
      })
    })

    await engine.controller.loadFile('av://lavfi:testsrc=duration=5:size=320x240:rate=25')
    await Promise.race([fileLoaded, delay(8000)])

    const width = await poll(
      () => engine.controller.getProperty<number | null>('width'),
      (w) => typeof w === 'number' && w > 0
    )
    expect(width).toBe(320)
  })

  it('emits observed property changes', async () => {
    const seen = new Set<string>()
    engine.controller.on('property-change', ({ name }) => seen.add(name))
    await engine.controller.observeProperties(OBSERVED_PROPERTIES)

    // observe_property fires once immediately with the current value.
    await poll(
      async () => seen.size,
      (n) => n > 0
    )
    expect(seen.size).toBeGreaterThan(0)
  })
})
