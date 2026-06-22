import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PlayerService } from './PlayerService'
import { PlayerStateStore } from '../state/PlayerStateStore'
import type { MpvEngine } from '../mpv/MpvEngine'

const shotsDir = mkdtempSync(join(tmpdir(), 'fp-svc-'))

/** Records every operation the service sends to the controller. */
class FakeController {
  readonly calls: unknown[][] = []
  async setProperty(name: string, value: unknown): Promise<void> {
    this.calls.push(['set', name, value])
  }
  async command(args: unknown[]): Promise<void> {
    this.calls.push(['command', ...args])
  }
  async getProperty(name: string): Promise<unknown> {
    // The reverse driver reads fps + position; keep position high so it never
    // hits the floor during these tests.
    if (name === 'container-fps') return 25
    if (name === 'time-pos') return 999
    return undefined
  }
}

function makeService(ready = true) {
  const store = new PlayerStateStore()
  const controller = new FakeController()
  const engine = { isReady: ready, controller } as unknown as MpvEngine
  const onScreenshotSaved = vi.fn()
  const service = new PlayerService({
    store,
    engine,
    screenshotDir: () => shotsDir,
    onScreenshotSaved
  })
  return { store, controller, service, onScreenshotSaved }
}

describe('PlayerService.dispatch', () => {
  it('executes mapped operations against the controller', async () => {
    const { controller, service } = makeService()
    await service.dispatch({ type: 'setBrightness', value: 20 })
    expect(controller.calls).toEqual([['set', 'brightness', 20]])
  })

  it('tracks horizontal-flip state locally (mpv has no flip property)', async () => {
    const { store, service } = makeService()
    expect(store.getState().video.flipH).toBe(false)
    await service.dispatch({ type: 'toggleFlipH' })
    expect(store.getState().video.flipH).toBe(true)
    await service.dispatch({ type: 'toggleFlipH' })
    expect(store.getState().video.flipH).toBe(false)
  })

  it('clears the flip flag on resetImage', async () => {
    const { store, service } = makeService()
    await service.dispatch({ type: 'toggleFlipH' })
    await service.dispatch({ type: 'resetImage' })
    expect(store.getState().video.flipH).toBe(false)
  })

  it('reports the saved screenshot path to the callback', async () => {
    const { service, onScreenshotSaved } = makeService()
    await service.dispatch({ type: 'screenshot' })
    expect(onScreenshotSaved).toHaveBeenCalledOnce()
    expect(onScreenshotSaved.mock.calls[0][0]).toContain(shotsDir)
  })

  it('serializes dispatch so a slow action never interleaves with the next', async () => {
    // Actions arrive from independent IPC calls; without serialization an action
    // fired during a slow one (e.g. a proxy build) would race shared state. Hold
    // the first action's only op open and prove the second waits for it.
    const store = new PlayerStateStore()
    const order: number[] = []
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => (release = resolve))
    const controller = {
      async setProperty(_name: string, value: unknown): Promise<void> {
        if (value === 1) {
          order.push(1)
          await gate // keep the first action in-flight
        } else {
          order.push(2)
        }
      },
      async command(): Promise<void> {},
      async getProperty(): Promise<unknown> {
        return undefined
      }
    }
    const engine = { isReady: true, controller } as unknown as MpvEngine
    const service = new PlayerService({ store, engine, screenshotDir: () => shotsDir })

    const first = service.dispatch({ type: 'setBrightness', value: 1 })
    const second = service.dispatch({ type: 'setBrightness', value: 2 })
    await Promise.resolve() // let microtasks drain up to the gate

    // The first op ran and is blocked; the second has NOT started yet.
    expect(order).toEqual([1])

    release()
    await Promise.all([first, second])
    expect(order).toEqual([1, 2])
  })

  it('keeps the queue alive after an action throws', async () => {
    const store = new PlayerStateStore()
    const order: number[] = []
    const controller = {
      async setProperty(_name: string, value: unknown): Promise<void> {
        order.push(value as number)
        if (value === 1) throw new Error('boom')
      },
      async command(): Promise<void> {},
      async getProperty(): Promise<unknown> {
        return undefined
      }
    }
    const engine = { isReady: true, controller } as unknown as MpvEngine
    const service = new PlayerService({ store, engine, screenshotDir: () => shotsDir })

    await expect(service.dispatch({ type: 'setBrightness', value: 1 })).rejects.toThrow('boom')
    await service.dispatch({ type: 'setBrightness', value: 2 })
    expect(order).toEqual([1, 2])
  })

  it('is a no-op when the engine is not ready', async () => {
    const { controller, service } = makeService(false)
    await service.dispatch({ type: 'playPause' })
    expect(controller.calls).toEqual([])
  })

  describe('reverse playback (direction mode + frame-step driver)', () => {
    afterEach(() => {
      if (vi.isFakeTimers()) {
        vi.runOnlyPendingTimers()
        vi.useRealTimers()
      }
    })

    it('toggles the backward-direction flag without ever using native play-direction', async () => {
      const { store, controller, service } = makeService()
      // Toggling reverse while paused just arms the direction (no stepping yet).
      await service.dispatch({ type: 'setLoopReverse', reverse: true })
      expect(store.getState().playback.loopReverse).toBe(true)
      expect(controller.calls.some((c) => c[1] === 'play-direction')).toBe(false)

      await service.dispatch({ type: 'setLoopReverse', reverse: false })
      expect(store.getState().playback.loopReverse).toBe(false)
    })

    it('keeps the backward direction across a seek (it is a persistent mode)', async () => {
      const { store, service } = makeService()
      await service.dispatch({ type: 'setLoopReverse', reverse: true })
      // Seeking used to cancel reverse; now direction is a mode and persists.
      await service.dispatch({ type: 'seekAbsolute', seconds: 5 })
      expect(store.getState().playback.loopReverse).toBe(true)
    })

    it('keeps the direction across a loop change (reverse composes with looping)', async () => {
      const { store, service } = makeService()
      await service.dispatch({ type: 'setLoopReverse', reverse: true })
      await service.dispatch({ type: 'setLoop', mode: 'file', start: null, end: null })
      expect(store.getState().playback.loopReverse).toBe(true)
    })

    it('starts the stepping driver only once playing with a backward direction', async () => {
      vi.useFakeTimers()
      const { store, controller, service } = makeService()
      await service.dispatch({ type: 'setLoopReverse', reverse: true }) // armed, paused
      await service.dispatch({ type: 'playPause' }) // now playing -> backward

      expect(store.getState().playback.loopReverse).toBe(true)
      // The driver holds mpv internally paused and steps; never play-direction.
      expect(controller.calls).toContainEqual(['set', 'pause', true])
      expect(controller.calls.some((c) => c[1] === 'play-direction')).toBe(false)
    })

    it('forward play/pause drives mpv pause directly (no driver)', async () => {
      const { controller, service } = makeService()
      await service.dispatch({ type: 'playPause' }) // paused -> play forward
      expect(controller.calls).toContainEqual(['set', 'pause', false])
      await service.dispatch({ type: 'setPaused', paused: true })
      expect(controller.calls).toContainEqual(['set', 'pause', true])
    })
  })

  describe('looping without a smooth-loop proxy (no mpv binary)', () => {
    it('applies native ab-loop ops and records the loop, leaving smoothLoop off', async () => {
      const { store, controller, service } = makeService()
      await service.dispatch({ type: 'setLoop', mode: 'ab', start: 3, end: 7 })

      // The three native loop ops land first; a trailing pause set re-establishes
      // motion in the new scope (playIntent is paused here).
      expect(controller.calls.slice(0, 3)).toEqual([
        ['set', 'loop-file', 'no'],
        ['set', 'ab-loop-a', 3],
        ['set', 'ab-loop-b', 7]
      ])
      expect(store.getState().playback).toMatchObject({
        loopMode: 'ab',
        loopStart: 3,
        loopEnd: 7,
        smoothLoop: 'off'
      })
    })

    it('leaves observed properties unchanged when no proxy is active', () => {
      const { service } = makeService()
      expect(service.remapObservedProperty('time-pos', 12)).toEqual({
        name: 'time-pos',
        value: 12
      })
    })
  })
})
