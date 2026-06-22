/**
 * Canonical mpv property names, in one place.
 *
 * Both the command map (UI action -> mpv) and the state bindings (mpv -> UI)
 * reference these constants, so a property name is spelled exactly once and a
 * rename is a single edit rather than a string hunt.
 */
export const MpvProperty = {
  pause: 'pause',
  mute: 'mute',
  volume: 'volume',
  speed: 'speed',
  timePos: 'time-pos',
  duration: 'duration',
  frameNumber: 'estimated-frame-number',
  frameCount: 'estimated-frame-count',
  fps: 'container-fps',
  path: 'path',
  brightness: 'brightness',
  contrast: 'contrast',
  videoZoom: 'video-zoom',
  videoPanX: 'video-pan-x',
  videoPanY: 'video-pan-y',
  loopFile: 'loop-file',
  abLoopA: 'ab-loop-a',
  abLoopB: 'ab-loop-b'
} as const

export type MpvPropertyName = (typeof MpvProperty)[keyof typeof MpvProperty]

/**
 * Hardware-decoding mode used for playback (`hwdec=auto-safe`) so 4K decodes on
 * the GPU. Reverse playback used to force this off (native backward decode
 * deadlocks with hwdec on), but reverse is now driven by frame-stepping (see
 * ReverseDriver), which is fully hwdec-compatible — so this stays on always.
 */
export const DEFAULT_HWDEC = 'auto-safe'
