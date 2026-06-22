import { describe, it, expect } from 'vitest'
import { mapActionToOperations, type CommandMapContext } from './commandMap'
import type { PlayerAction } from '@shared/player-actions'

const ctx: CommandMapContext = { screenshotPath: 'C:\\shots\\frame.png' }
const map = (action: PlayerAction) => mapActionToOperations(action, ctx)

describe('mapActionToOperations', () => {
  it('loads a file by replacing current playback', () => {
    expect(map({ type: 'load', path: 'C:\\v.mp4' })).toEqual([
      { kind: 'command', args: ['loadfile', 'C:\\v.mp4', 'replace'] }
    ])
  })

  it('uses cycle for play/pause and mute toggles (stateless)', () => {
    expect(map({ type: 'playPause' })).toEqual([{ kind: 'command', args: ['cycle', 'pause'] }])
    expect(map({ type: 'toggleMute' })).toEqual([{ kind: 'command', args: ['cycle', 'mute'] }])
  })

  it('seeks exactly (frame-accurate) for absolute and relative', () => {
    expect(map({ type: 'seekAbsolute', seconds: 12 })).toEqual([
      { kind: 'command', args: ['seek', 12, 'absolute', 'exact'] }
    ])
    expect(map({ type: 'seekRelative', seconds: -5 })).toEqual([
      { kind: 'command', args: ['seek', -5, 'relative', 'exact'] }
    ])
  })

  it('uses a fast keyframe seek for an imprecise (live-scrub) absolute seek', () => {
    expect(map({ type: 'seekAbsolute', seconds: 12, precise: false })).toEqual([
      { kind: 'command', args: ['seek', 12, 'absolute', 'keyframes'] }
    ])
    expect(map({ type: 'seekAbsolute', seconds: 12, precise: true })).toEqual([
      { kind: 'command', args: ['seek', 12, 'absolute', 'exact'] }
    ])
  })

  it('maps frame stepping to mpv frame commands', () => {
    expect(map({ type: 'frameStep' })).toEqual([{ kind: 'command', args: ['frame-step'] }])
    expect(map({ type: 'frameBackStep' })).toEqual([
      { kind: 'command', args: ['frame-back-step'] }
    ])
  })

  it('clamps volume into 0..100', () => {
    expect(map({ type: 'setVolume', value: 150 })).toEqual([
      { kind: 'set', property: 'volume', value: 100 }
    ])
    expect(map({ type: 'setVolume', value: -10 })).toEqual([
      { kind: 'set', property: 'volume', value: 0 }
    ])
  })

  it('clamps playback speed into the allowed range', () => {
    expect(map({ type: 'setSpeed', value: 2 })).toEqual([
      { kind: 'set', property: 'speed', value: 2 }
    ])
    expect(map({ type: 'setSpeed', value: 99 })).toEqual([
      { kind: 'set', property: 'speed', value: 4 }
    ])
    expect(map({ type: 'setSpeed', value: 0 })).toEqual([
      { kind: 'set', property: 'speed', value: 0.25 }
    ])
  })

  it('arms a whole-file loop and clears any A-B range', () => {
    expect(map({ type: 'setLoop', mode: 'file', start: null, end: null })).toEqual([
      { kind: 'set', property: 'loop-file', value: 'inf' },
      { kind: 'set', property: 'ab-loop-a', value: 'no' },
      { kind: 'set', property: 'ab-loop-b', value: 'no' }
    ])
  })

  it('arms an A-B segment loop with the given seconds', () => {
    expect(map({ type: 'setLoop', mode: 'ab', start: 3, end: 7.5 })).toEqual([
      { kind: 'set', property: 'loop-file', value: 'no' },
      { kind: 'set', property: 'ab-loop-a', value: 3 },
      { kind: 'set', property: 'ab-loop-b', value: 7.5 }
    ])
  })

  it('leaves an unset A-B end-point cleared (no), arming only what is set', () => {
    expect(map({ type: 'setLoop', mode: 'ab', start: 3, end: null })).toEqual([
      { kind: 'set', property: 'loop-file', value: 'no' },
      { kind: 'set', property: 'ab-loop-a', value: 3 },
      { kind: 'set', property: 'ab-loop-b', value: 'no' }
    ])
  })

  it('clears every loop property when looping is turned off', () => {
    expect(map({ type: 'setLoop', mode: 'off', start: 3, end: 7 })).toEqual([
      { kind: 'set', property: 'loop-file', value: 'no' },
      { kind: 'set', property: 'ab-loop-a', value: 'no' },
      { kind: 'set', property: 'ab-loop-b', value: 'no' }
    ])
  })

  it('emits no mpv ops for reverse (driven by PlayerService frame-stepping)', () => {
    expect(map({ type: 'setLoopReverse', reverse: true })).toEqual([])
    expect(map({ type: 'setLoopReverse', reverse: false })).toEqual([])
  })

  it('sets absolute zoom and nudges zoom relatively', () => {
    expect(map({ type: 'setZoom', value: 1.5 })).toEqual([
      { kind: 'set', property: 'video-zoom', value: 1.5 }
    ])
    expect(map({ type: 'nudgeZoom', delta: 0.1 })).toEqual([
      { kind: 'command', args: ['add', 'video-zoom', 0.1] }
    ])
  })

  it('sets both pan axes together', () => {
    expect(map({ type: 'setPan', x: 0.2, y: -0.3 })).toEqual([
      { kind: 'set', property: 'video-pan-x', value: 0.2 },
      { kind: 'set', property: 'video-pan-y', value: -0.3 }
    ])
  })

  it('clamps brightness and contrast into -100..100', () => {
    expect(map({ type: 'setBrightness', value: 999 })).toEqual([
      { kind: 'set', property: 'brightness', value: 100 }
    ])
    expect(map({ type: 'setContrast', value: -999 })).toEqual([
      { kind: 'set', property: 'contrast', value: -100 }
    ])
  })

  it('toggles horizontal flip via the vf filter chain', () => {
    expect(map({ type: 'toggleFlipH' })).toEqual([
      { kind: 'command', args: ['vf', 'toggle', 'hflip'] }
    ])
  })

  it('screenshots losslessly from decoded video pixels into the resolved path', () => {
    expect(map({ type: 'screenshot' })).toEqual([
      { kind: 'command', args: ['screenshot-to-file', 'C:\\shots\\frame.png', 'video'] }
    ])
  })

  it('resets only the view geometry (zoom + pan) on resetView', () => {
    expect(map({ type: 'resetView' })).toEqual([
      { kind: 'set', property: 'video-zoom', value: 0 },
      { kind: 'set', property: 'video-pan-x', value: 0 },
      { kind: 'set', property: 'video-pan-y', value: 0 }
    ])
  })

  it('resets all image corrections and removes the flip filter', () => {
    expect(map({ type: 'resetImage' })).toEqual([
      { kind: 'set', property: 'brightness', value: 0 },
      { kind: 'set', property: 'contrast', value: 0 },
      { kind: 'set', property: 'video-zoom', value: 0 },
      { kind: 'set', property: 'video-pan-x', value: 0 },
      { kind: 'set', property: 'video-pan-y', value: 0 },
      { kind: 'command', args: ['vf', 'remove', 'hflip'] }
    ])
  })
})
