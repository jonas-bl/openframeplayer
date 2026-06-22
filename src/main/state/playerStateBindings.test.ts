import { describe, it, expect } from 'vitest'
import { applyPropertyChange } from './playerStateBindings'
import { DEFAULT_PLAYER_STATE } from '@shared/player-state'

describe('applyPropertyChange', () => {
  it('maps playback properties into the playback slice', () => {
    let state = DEFAULT_PLAYER_STATE
    state = applyPropertyChange(state, 'pause', false)
    state = applyPropertyChange(state, 'time-pos', 3.5)
    state = applyPropertyChange(state, 'duration', 120)
    state = applyPropertyChange(state, 'estimated-frame-number', 84)
    state = applyPropertyChange(state, 'container-fps', 24)

    expect(state.playback).toMatchObject({
      paused: false,
      position: 3.5,
      duration: 120,
      frame: 84,
      fps: 24
    })
  })

  it('maps image properties into the video slice', () => {
    let state = DEFAULT_PLAYER_STATE
    state = applyPropertyChange(state, 'brightness', 15)
    state = applyPropertyChange(state, 'video-zoom', 0.5)
    state = applyPropertyChange(state, 'video-pan-x', -0.2)

    expect(state.video).toMatchObject({ brightness: 15, zoom: 0.5, panX: -0.2 })
  })

  it('sets filePath from path, and null when cleared', () => {
    const loaded = applyPropertyChange(DEFAULT_PLAYER_STATE, 'path', 'C:\\clip.mkv')
    expect(loaded.playback.filePath).toBe('C:\\clip.mkv')

    const cleared = applyPropertyChange(loaded, 'path', null)
    expect(cleared.playback.filePath).toBeNull()
  })

  it('ignores null/invalid numbers by keeping the previous value', () => {
    const seeded = applyPropertyChange(DEFAULT_PLAYER_STATE, 'time-pos', 10)
    const afterNull = applyPropertyChange(seeded, 'time-pos', null)
    expect(afterNull.playback.position) // mpv sends null e.g. while idle
      .toBe(10)
  })

  it('does not mutate the input state (returns a fresh object)', () => {
    const before = DEFAULT_PLAYER_STATE
    const after = applyPropertyChange(before, 'pause', false)
    expect(after).not.toBe(before)
    expect(before.playback.paused).toBe(true)
  })

  it('passes unknown properties through unchanged', () => {
    const before = DEFAULT_PLAYER_STATE
    const after = applyPropertyChange(before, 'some-unobserved-prop', 42)
    expect(after).toBe(before)
  })
})
