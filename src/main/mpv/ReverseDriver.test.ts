import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ReverseDriver, computeReverseBounds, type ReverseControls } from './ReverseDriver'
import type { MpvScalar } from './protocol'

/** A fake mpv controller that tracks position as frame-back-steps arrive. */
class FakeControls implements ReverseControls {
  position = 10
  fps = 25
  paused = false
  readonly commands: MpvScalar[][] = []

  async getProperty<T = unknown>(name: string): Promise<T> {
    if (name === 'time-pos') return this.position as unknown as T
    if (name === 'container-fps') return this.fps as unknown as T
    return undefined as unknown as T
  }
  async command(args: MpvScalar[]): Promise<unknown> {
    this.commands.push(args)
    if (args[0] === 'frame-back-step') this.position -= 1 / this.fps
    if (args[0] === 'seek') this.position = args[1] as number
    return undefined
  }
  async setProperty(name: string, value: MpvScalar): Promise<void> {
    if (name === 'pause') this.paused = value as boolean
  }
}

describe('computeReverseBounds', () => {
  it('walks an A-B loop back from A and wraps to B', () => {
    expect(
      computeReverseBounds({ loopMode: 'ab', loopStart: 3, loopEnd: 7.5, duration: 60 })
    ).toEqual({ floor: 3, wrapTo: 7.5 })
  })

  it('falls back to start/duration for an A-B loop with unset points', () => {
    expect(
      computeReverseBounds({ loopMode: 'ab', loopStart: null, loopEnd: null, duration: 60 })
    ).toEqual({ floor: 0, wrapTo: 60 })
  })

  it('wraps a whole-file loop from start to the end', () => {
    expect(
      computeReverseBounds({ loopMode: 'file', loopStart: null, loopEnd: null, duration: 42 })
    ).toEqual({ floor: 0, wrapTo: 42 })
  })

  it('stops at the start (no wrap) when no loop is active', () => {
    expect(
      computeReverseBounds({ loopMode: 'off', loopStart: 3, loopEnd: 7, duration: 60 })
    ).toEqual({ floor: 0, wrapTo: null })
  })
})

describe('ReverseDriver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  it('pauses mpv and walks the play head back with seeks at the clip rate', async () => {
    const controls = new FakeControls()
    const driver = new ReverseDriver(() => controls, vi.fn())

    await driver.start({ floor: 0, wrapTo: null })
    expect(controls.paused).toBe(true)
    expect(driver.isRunning).toBe(true)

    await vi.advanceTimersByTimeAsync(200)
    // Backward exact seeks (not frame-back-step, which needs a back buffer).
    const seeks = controls.commands.filter((c) => c[0] === 'seek')
    expect(seeks.length).toBeGreaterThan(0)
    expect(controls.commands.some((c) => c[0] === 'frame-back-step')).toBe(false)
    expect(controls.position).toBeLessThan(10)
  })

  it('seeks to the wrap point when it reaches the floor', async () => {
    const controls = new FakeControls()
    controls.position = 3.01
    const driver = new ReverseDriver(() => controls, vi.fn())

    await driver.start({ floor: 3, wrapTo: 7.5 })
    await vi.advanceTimersByTimeAsync(100)

    // On hitting the floor it jumps back to the wrap point (then keeps looping).
    expect(controls.commands).toContainEqual(['seek', 7.5, 'absolute', 'exact'])
    expect(controls.position).toBeGreaterThan(3)
  })

  it('stops and notifies when it reaches the floor with no wrap target', async () => {
    const controls = new FakeControls()
    controls.position = 0
    const onFinished = vi.fn()
    const driver = new ReverseDriver(() => controls, onFinished)

    await driver.start({ floor: 0, wrapTo: null })
    await vi.advanceTimersByTimeAsync(100)

    expect(onFinished).toHaveBeenCalledOnce()
    expect(driver.isRunning).toBe(false)
    // Already at the floor with no wrap: it finishes without stepping at all.
    expect(controls.commands.some((c) => c[0] === 'seek')).toBe(false)
  })

  it('asks onExtend for the next window at the floor, continues, then finishes on null', async () => {
    const controls = new FakeControls()
    controls.position = 0
    const onFinished = vi.fn()
    let calls = 0
    const onExtend = vi.fn(async () => {
      calls++
      if (calls === 1) {
        // The preloaded window repositions the head near its end (kept close to
        // the floor here so it drains within the test's fake-timer budget).
        controls.position = 0.05
        return { floor: 0, wrapTo: null }
      }
      return null // no earlier video: stop
    })
    const driver = new ReverseDriver(() => controls, onFinished, onExtend)

    await driver.start({ floor: 0, wrapTo: null })
    await vi.advanceTimersByTimeAsync(400)

    expect(onExtend.mock.calls.length).toBeGreaterThanOrEqual(2)
    // It stepped backward through the extended window after repositioning.
    expect(controls.commands.some((c) => c[0] === 'seek')).toBe(true)
    expect(onFinished).toHaveBeenCalledOnce()
    expect(driver.isRunning).toBe(false)
  })

  it('steps back from the seed even while mpv still reports a transient 0 (fresh swap)', async () => {
    // Regression: right after a proxy swap `time-pos` briefly reads ~0 before the
    // `start=` seek settles. With a seed the driver must trust the seed, not that
    // transient 0 — otherwise a whole-file window thinks it is already at the
    // start and finishes on one frame.
    const controls = new FakeControls()
    controls.position = 0 // mpv hasn't settled on the engaged window-end yet
    const onFinished = vi.fn()
    const driver = new ReverseDriver(() => controls, onFinished)

    await driver.start({ floor: 0, wrapTo: null }, 5) // engaged at 5s
    await vi.advanceTimersByTimeAsync(120)

    expect(onFinished).not.toHaveBeenCalled()
    const seeks = controls.commands.filter((c) => c[0] === 'seek')
    expect(seeks.length).toBeGreaterThan(0)
    // It walked back from the seed (5), not forward/floor.
    expect(controls.position).toBeLessThan(5)
    expect(controls.position).toBeGreaterThan(3)
  })

  it('does not wrap forward off a transient 0 on an A-B loop (seed wins)', async () => {
    // The A-B variant of the same bug: a transient 0 would look like the floor
    // and wrap the head forward to B, oscillating forever. The seed prevents it.
    const controls = new FakeControls()
    controls.position = 0
    const driver = new ReverseDriver(() => controls, vi.fn())

    await driver.start({ floor: 0, wrapTo: 4 }, 4) // proxy loop length 4, head at end
    await vi.advanceTimersByTimeAsync(80)

    // No immediate jump to the wrap point (4) off the transient 0.
    expect(controls.commands.slice(0, 1)).not.toContainEqual(['seek', 4, 'absolute', 'exact'])
    expect(controls.position).toBeLessThan(4)
  })

  it('issues no further commands after stop()', async () => {
    const controls = new FakeControls()
    const driver = new ReverseDriver(() => controls, vi.fn())

    await driver.start({ floor: 0, wrapTo: null })
    await vi.advanceTimersByTimeAsync(60)
    driver.stop()
    const count = controls.commands.length
    await vi.advanceTimersByTimeAsync(200)

    expect(controls.commands.length).toBe(count)
    expect(driver.isRunning).toBe(false)
  })

  it('stops itself when the engine has gone away', async () => {
    const onFinished = vi.fn()
    const driver = new ReverseDriver(() => null, onFinished)
    await driver.start({ floor: 0, wrapTo: null })
    expect(driver.isRunning).toBe(false)
  })
})
