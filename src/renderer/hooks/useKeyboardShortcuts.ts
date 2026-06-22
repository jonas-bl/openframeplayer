import { useEffect } from 'react'
import {
  APP_COMMANDS,
  normalizeKey,
  parseBinding,
  type AppCommand,
  type Modifier
} from '@shared/commands'
import { useCommands } from '../commands/useCommands'
import { useSettingsStore } from '../state/settingsStore'
import { useUiStore } from '../state/uiStore'
import { useAnnotationStore } from '../state/annotationStore'

/** Commands that may fire on auto-repeat (holding the key). */
const REPEATABLE = new Set<AppCommand>([
  'frameBack',
  'frameForward',
  'zoomIn',
  'zoomOut',
  'speedUp',
  'speedDown'
])

/** A normalized key press / wheel notch with its optional chord modifier. */
export interface InputChord {
  key: string
  modifier: Modifier | null
}

/** True when the user is typing in a form control we shouldn't hijack. */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

/** The active chord modifier for an event (Ctrl/Alt; Shift stays transparent). */
export function chordModifier(e: { ctrlKey: boolean; altKey: boolean }): Modifier | null {
  if (e.ctrlKey) return 'Ctrl'
  if (e.altKey) return 'Alt'
  return null
}

/** Pure chord → command resolution against the current bindings (unit-tested). */
export function matchCommand(
  chord: InputChord,
  keybindings: Record<AppCommand, string[]>
): AppCommand | null {
  const key = normalizeKey(chord.key)
  for (const command of APP_COMMANDS) {
    for (const raw of keybindings[command]) {
      const binding = parseBinding(raw)
      if (binding.modifier === chord.modifier && normalizeKey(binding.key) === key) return command
    }
  }
  return null
}

/**
 * Global keyboard shortcuts, driven by the user-configurable keybindings.
 * Resolves a pressed key (plus optional Ctrl/Alt modifier) to a command and
 * runs it. Escape closes the settings modal or exits fullscreen; shortcuts are
 * suppressed while a form control is focused or the settings modal is open.
 */
export function useKeyboardShortcuts(): void {
  const runCommand = useCommands()
  const keybindings = useSettingsStore((s) => s.settings.keybindings)
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const fullscreen = useUiStore((s) => s.fullscreen)
  const closeSettings = useUiStore((s) => s.closeSettings)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target) || event.metaKey) return

      if (event.key === 'Escape') {
        if (settingsOpen) {
          event.preventDefault()
          closeSettings()
        } else if (useAnnotationStore.getState().toolMode !== 'none') {
          event.preventDefault()
          useAnnotationStore.getState().setToolMode('none')
        } else if (fullscreen) {
          event.preventDefault()
          window.windowControls.toggleFullscreen()
        }
        return
      }

      if (settingsOpen) return

      const command = matchCommand(
        { key: event.key, modifier: chordModifier(event) },
        keybindings
      )
      if (!command) return
      if (event.repeat && !REPEATABLE.has(command)) return
      event.preventDefault()
      runCommand(command)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [runCommand, keybindings, settingsOpen, fullscreen, closeSettings])
}
