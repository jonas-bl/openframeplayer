/**
 * The app's bindable commands.
 *
 * A command is a semantic, user-triggerable action (from a key or a button).
 * Some map to a {@link import('./player-actions').PlayerAction} sent to mpv;
 * others are app-level (fullscreen, panels, settings) handled in the renderer.
 * Keybindings bind a key to a command, so the two concerns stay decoupled.
 */
export const APP_COMMANDS = [
  'playPause',
  'frameBack',
  'frameForward',
  'speedUp',
  'speedDown',
  'speedReset',
  'toggleLoop',
  'setLoopStart',
  'setLoopEnd',
  'clearLoop',
  'toggleLoopReverse',
  'addMarker',
  'nextMarker',
  'prevMarker',
  'zoomIn',
  'zoomOut',
  'screenshot',
  'screenshotEditor',
  'flipHorizontal',
  'resetImage',
  'resetView',
  'toggleAlwaysOnTop',
  'toggleDrawMode',
  'toggleAutofocus',
  'toggleKeepCentered',
  'undoAnnotation',
  'clearAnnotations',
  'openFile',
  'newWindow',
  'toggleFullscreen',
  'popoutControls',
  'openSettings'
] as const

export type AppCommand = (typeof APP_COMMANDS)[number]

export type CommandGroup = 'Playback' | 'View' | 'Image' | 'Tools' | 'App'

export interface CommandMeta {
  command: AppCommand
  label: string
  group: CommandGroup
}

/** Human labels + grouping, used by the settings UI. */
export const COMMAND_META: Record<AppCommand, CommandMeta> = {
  playPause: { command: 'playPause', label: 'Play / Pause', group: 'Playback' },
  frameBack: { command: 'frameBack', label: 'Previous frame', group: 'Playback' },
  frameForward: { command: 'frameForward', label: 'Next frame', group: 'Playback' },
  speedUp: { command: 'speedUp', label: 'Speed up', group: 'Playback' },
  speedDown: { command: 'speedDown', label: 'Slow down', group: 'Playback' },
  speedReset: { command: 'speedReset', label: 'Reset speed', group: 'Playback' },
  toggleLoop: { command: 'toggleLoop', label: 'Cycle loop (off / file / A-B)', group: 'Playback' },
  setLoopStart: { command: 'setLoopStart', label: 'Set loop start (A)', group: 'Playback' },
  setLoopEnd: { command: 'setLoopEnd', label: 'Set loop end (B)', group: 'Playback' },
  clearLoop: { command: 'clearLoop', label: 'Clear loop', group: 'Playback' },
  toggleLoopReverse: {
    command: 'toggleLoopReverse',
    label: 'Reverse loop playback',
    group: 'Playback'
  },
  addMarker: { command: 'addMarker', label: 'Add marker at playhead', group: 'Playback' },
  nextMarker: { command: 'nextMarker', label: 'Jump to next marker', group: 'Playback' },
  prevMarker: { command: 'prevMarker', label: 'Jump to previous marker', group: 'Playback' },
  zoomIn: { command: 'zoomIn', label: 'Zoom in', group: 'View' },
  zoomOut: { command: 'zoomOut', label: 'Zoom out', group: 'View' },
  resetView: { command: 'resetView', label: 'Reset zoom & pan', group: 'View' },
  toggleFullscreen: { command: 'toggleFullscreen', label: 'Toggle fullscreen', group: 'View' },
  toggleAlwaysOnTop: {
    command: 'toggleAlwaysOnTop',
    label: 'Always on top (picture-in-picture)',
    group: 'View'
  },
  screenshot: { command: 'screenshot', label: 'Screenshot (save directly)', group: 'Image' },
  screenshotEditor: { command: 'screenshotEditor', label: 'Screenshot (open editor)', group: 'Image' },
  flipHorizontal: { command: 'flipHorizontal', label: 'Flip horizontal', group: 'Image' },
  resetImage: { command: 'resetImage', label: 'Reset image corrections', group: 'Image' },
  toggleDrawMode: { command: 'toggleDrawMode', label: 'Draw on video', group: 'Tools' },
  toggleAutofocus: { command: 'toggleAutofocus', label: 'Autofocus (click to centre)', group: 'Tools' },
  toggleKeepCentered: { command: 'toggleKeepCentered', label: 'Keep autofocus centred', group: 'Tools' },
  undoAnnotation: { command: 'undoAnnotation', label: 'Undo drawing', group: 'Tools' },
  clearAnnotations: { command: 'clearAnnotations', label: 'Clear drawings', group: 'Tools' },
  openFile: { command: 'openFile', label: 'Open file…', group: 'App' },
  newWindow: { command: 'newWindow', label: 'New window', group: 'App' },
  popoutControls: { command: 'popoutControls', label: 'Pop out controls', group: 'App' },
  openSettings: { command: 'openSettings', label: 'Open settings', group: 'App' }
}

/**
 * Default bindings for each command. A command can have several bindings; any
 * one of them triggers it. A binding string is `[modifier+]key`, where the
 * optional modifier is `Ctrl` or `Alt` and the key is a `KeyboardEvent.key`
 * value or a wheel token (`WheelUp` / `WheelDown`). See {@link parseBinding}.
 *
 * Zoom is bound to the mouse wheel by default *and* to `+` / `-`, so the wheel
 * is just one binding among others and can be removed or supplemented in the
 * settings. Speed defaults to Ctrl + mouse wheel (the requested gesture).
 */
export const DEFAULT_KEYBINDINGS: Record<AppCommand, string[]> = {
  playPause: [' '],
  frameBack: ['ArrowLeft'],
  frameForward: ['ArrowRight'],
  speedUp: ['Ctrl+WheelUp'],
  speedDown: ['Ctrl+WheelDown'],
  speedReset: ['Ctrl+0'],
  toggleLoop: ['l'],
  setLoopStart: ['['],
  setLoopEnd: [']'],
  clearLoop: ['\\'],
  toggleLoopReverse: ['Alt+l'],
  addMarker: ['m'],
  nextMarker: ['Alt+ArrowRight'],
  prevMarker: ['Alt+ArrowLeft'],
  zoomIn: ['WheelUp', '+'],
  zoomOut: ['WheelDown', '-'],
  resetView: ['d'],
  toggleAlwaysOnTop: ['t'],
  toggleDrawMode: ['b'],
  toggleAutofocus: ['a'],
  toggleKeepCentered: ['c'],
  undoAnnotation: ['Ctrl+z'],
  clearAnnotations: ['Ctrl+Backspace'],
  toggleFullscreen: ['F11'],
  screenshot: ['Ctrl+s'],
  screenshotEditor: ['s'],
  flipHorizontal: ['f'],
  resetImage: ['r'],
  openFile: ['o'],
  newWindow: ['n'],
  popoutControls: ['p'],
  openSettings: [',']
}

/**
 * Optional chord modifiers. Limited to Ctrl and Alt because they don't alter
 * the character a key produces (Shift does — e.g. it's how `+` is typed — so
 * treating Shift as a required modifier would break bindings like zoom-in).
 */
export type Modifier = 'Ctrl' | 'Alt'

export const MODIFIERS: readonly Modifier[] = ['Ctrl', 'Alt']

/** Wheel-direction tokens usable as the key part of a binding. */
export const WHEEL_UP = 'WheelUp'
export const WHEEL_DOWN = 'WheelDown'

export interface ParsedBinding {
  modifier: Modifier | null
  key: string
}

/** Splits a binding string into its optional modifier and its key. */
export function parseBinding(binding: string): ParsedBinding {
  for (const modifier of MODIFIERS) {
    const prefix = `${modifier}+`
    if (binding.startsWith(prefix) && binding.length > prefix.length) {
      return { modifier, key: binding.slice(prefix.length) }
    }
  }
  return { modifier: null, key: binding }
}

/** Builds a binding string from a modifier (optional) and a key. */
export function makeBinding(modifier: Modifier | null, key: string): string {
  return modifier ? `${modifier}+${key}` : key
}

/** True for the wheel tokens (so callers can branch key vs. wheel matching). */
export function isWheelKey(key: string): boolean {
  return key === WHEEL_UP || key === WHEEL_DOWN
}

/**
 * Normalises a `KeyboardEvent.key` for binding/matching: letters lower-cased,
 * and `=` treated as `+` (so zoom-in works without pressing Shift). Wheel
 * tokens pass through untouched.
 */
export function normalizeKey(key: string): string {
  if (key === '=') return '+'
  return key.length === 1 ? key.toLowerCase() : key
}

/** Pretty label for a key, for display in the UI. */
export function formatKey(key: string): string {
  const map: Record<string, string> = {
    ' ': 'Space',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Escape: 'Esc',
    [WHEEL_UP]: 'Scroll ↑',
    [WHEEL_DOWN]: 'Scroll ↓'
  }
  if (map[key]) return map[key]
  return key.length === 1 ? key.toUpperCase() : key
}

/** Pretty label for a full binding, e.g. `Ctrl + Scroll ↑`. */
export function formatBinding(binding: string): string {
  const { modifier, key } = parseBinding(binding)
  const keyLabel = formatKey(key)
  return modifier ? `${modifier} + ${keyLabel}` : keyLabel
}

/**
 * Canonical form of a binding for conflict/equality checks. Mirrors what the
 * matcher compares: the modifier plus the {@link normalizeKey}-folded key, so
 * `=`/`+` and `S`/`s` are recognised as the same chord.
 */
export function canonicalBinding(binding: string): string {
  const { modifier, key } = parseBinding(binding)
  return makeBinding(modifier, normalizeKey(key))
}

/**
 * Commands already bound to `binding`, excluding `exclude` (the command being
 * edited). Two bindings conflict when they resolve to the same chord — the same
 * thing the keyboard matcher would fire — so the result is exactly the set of
 * other commands that would also respond to that key.
 */
export function findBindingConflicts(
  keybindings: Record<AppCommand, string[]>,
  binding: string,
  exclude?: AppCommand
): AppCommand[] {
  const target = canonicalBinding(binding)
  const hits: AppCommand[] = []
  for (const command of APP_COMMANDS) {
    if (command === exclude) continue
    if ((keybindings[command] ?? []).some((b) => canonicalBinding(b) === target)) {
      hits.push(command)
    }
  }
  return hits
}
