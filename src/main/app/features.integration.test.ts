import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MpvEngine } from '../mpv/MpvEngine'
import { MpvController } from '../mpv/MpvController'
import { PlayerStateStore } from '../state/PlayerStateStore'
import { PlayerService } from './PlayerService'

/**
 * End-to-end verification of the mandatory features (step 5) through the REAL
 * stack: PlayerAction -> command map -> mpv -> read back. Confirms each control
 * actually drives mpv, including a genuine lossless PNG screenshot on disk.
 * Auto-skips when the bundled mpv is absent.
 */
const mpvPath = join(process.cwd(), 'resources', 'mpv', 'mpv.exe')
const hasMpv = existsSync(mpvPath)

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function poll<T>(read: () => Promise<T>, accept: (v: T) => boolean, timeoutMs = 6000): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs
  let last: T | undefined
  for (;;) {
    try {
      last = await read()
      if (accept(last)) return last
    } catch {
      /* not ready */
    }
    if (Date.now() >= deadline) return last
    await delay(100)
  }
}

describe.skipIf(!hasMpv)('Mandatory features integration (requires bundled mpv)', () => {
  let engine: MpvEngine
  let controller: MpvController
  let service: PlayerService
  let screenshotDir: string
  const onScreenshotSaved = vi.fn()

  beforeAll(async () => {
    screenshotDir = mkdtempSync(join(tmpdir(), 'fp-shots-'))
    engine = new MpvEngine({ binaryPath: mpvPath, screenshotDir })
    await engine.start()
    controller = engine.controller

    const store = new PlayerStateStore()
    service = new PlayerService({ store, engine, screenshotDir: () => screenshotDir, onScreenshotSaved })

    await controller.loadFile('av://lavfi:testsrc=duration=10:size=320x240:rate=25')
    await poll(() => controller.getProperty<number | null>('width'), (w) => typeof w === 'number' && w! > 0)
  }, 20000)

  afterAll(() => {
    engine?.dispose()
    if (screenshotDir) rmSync(screenshotDir, { recursive: true, force: true })
  })

  it('Feature 4: brightness applies', async () => {
    await service.dispatch({ type: 'setBrightness', value: 40 })
    expect(await controller.getProperty<number>('brightness')).toBe(40)
  })

  it('Feature 4: contrast applies', async () => {
    await service.dispatch({ type: 'setContrast', value: -25 })
    expect(await controller.getProperty<number>('contrast')).toBe(-25)
  })

  it('Feature 1: zoom nudges accumulate on video-zoom', async () => {
    await service.dispatch({ type: 'setZoom', value: 0 })
    await service.dispatch({ type: 'nudgeZoom', delta: 0.5 })
    await service.dispatch({ type: 'nudgeZoom', delta: 0.5 })
    expect(await controller.getProperty<number>('video-zoom')).toBeCloseTo(1.0, 5)
  })

  it('Feature 1: pan sets both axes', async () => {
    await service.dispatch({ type: 'setPan', x: 0.25, y: -0.1 })
    expect(await controller.getProperty<number>('video-pan-x')).toBeCloseTo(0.25, 5)
    expect(await controller.getProperty<number>('video-pan-y')).toBeCloseTo(-0.1, 5)
  })

  it('Feature 2: frame-step advances exactly one frame while paused', async () => {
    await service.dispatch({ type: 'seekAbsolute', seconds: 0 })
    await service.dispatch({ type: 'setPaused', paused: true })
    const before = await poll(
      () => controller.getProperty<number | null>('estimated-frame-number'),
      (f) => typeof f === 'number'
    )
    await service.dispatch({ type: 'frameStep' })
    const after = await poll(
      () => controller.getProperty<number | null>('estimated-frame-number'),
      (f) => typeof f === 'number' && f! > (before as number)
    )
    expect(after as number).toBeGreaterThan(before as number)
  })

  it('Feature 5: horizontal flip adds the hflip filter', async () => {
    await service.dispatch({ type: 'toggleFlipH' })
    const vf = await controller.getProperty<Array<{ name: string }>>('vf')
    expect(vf.some((f) => f.name === 'hflip')).toBe(true)
  })

  it('Feature 3: screenshot writes a lossless PNG to disk', async () => {
    await service.dispatch({ type: 'screenshot' })
    expect(onScreenshotSaved).toHaveBeenCalled()
    const path = onScreenshotSaved.mock.calls.at(-1)![0] as string

    const file = await poll(async () => existsSync(path), (e) => e === true)
    expect(file).toBe(true)

    const bytes = readFileSync(path)
    expect(bytes.length).toBeGreaterThan(0)
    // PNG magic number.
    expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('Reset: clears corrections and removes the flip filter', async () => {
    await service.dispatch({ type: 'resetImage' })
    expect(await controller.getProperty<number>('brightness')).toBe(0)
    expect(await controller.getProperty<number>('contrast')).toBe(0)
    expect(await controller.getProperty<number>('video-zoom')).toBeCloseTo(0, 5)
    const vf = await controller.getProperty<Array<{ name: string }>>('vf')
    expect(vf.some((f) => f.name === 'hflip')).toBe(false)
  })
})
