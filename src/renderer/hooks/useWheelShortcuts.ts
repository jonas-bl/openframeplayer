import { useEffect } from 'react'
import { WHEEL_DOWN, WHEEL_UP } from '@shared/commands'
import { useCommands } from '../commands/useCommands'
import { useSettingsStore } from '../state/settingsStore'
import { useUiStore } from '../state/uiStore'
import { chordModifier, matchCommand } from './useKeyboardShortcuts'

/**
 * Global wheel shortcuts: a wheel notch (optionally with a Ctrl/Alt modifier)
 * resolves to a bound command and runs it — e.g. Ctrl + scroll for playback
 * speed, or a plain wheel rebound to step frames.
 *
 * Registered as a NON-passive native listener so it can `preventDefault` the
 * browser's own Ctrl+wheel page-zoom — React's synthetic `onWheel` is passive
 * and cannot. Plain-wheel zoom over the video is the one exception: it is left
 * to {@link useVideoGestures} so it can anchor the zoom to the cursor.
 */
export function useWheelShortcuts(): void {
  const runCommand = useCommands()
  const keybindings = useSettingsStore((s) => s.settings.keybindings)
  const settingsOpen = useUiStore((s) => s.settingsOpen)

  useEffect(() => {
    const onWheel = (event: WheelEvent): void => {
      if (settingsOpen) return
      const modifier = chordModifier(event)
      const command = matchCommand(
        { key: event.deltaY < 0 ? WHEEL_UP : WHEEL_DOWN, modifier },
        keybindings
      )
      if (!command) return
      // Plain-wheel zoom is handled (with cursor anchoring) by useVideoGestures;
      // skip it here so the two listeners don't both fire for the same notch.
      if (!modifier && (command === 'zoomIn' || command === 'zoomOut')) return
      event.preventDefault()
      runCommand(command)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [runCommand, keybindings, settingsOpen])
}
