import { useEffect, useState } from 'react'
import { usePlayerStore, selectPlayback } from '../state/playerStore'

/** Don't offer to resume unless we're at least this far in. */
const RESUME_MIN_SECONDS = 10
/** How often to persist the current position while a file is open. */
const SAVE_INTERVAL_MS = 5000

interface Resume {
  /** Seconds to resume at when a prompt is showing, else null. */
  promptSeconds: number | null
  onResume: () => void
  onDismiss: () => void
}

/**
 * Resume-playback bookkeeping for the main window:
 *  - when a new file loads, looks up its saved position and (if meaningful)
 *    surfaces a "resume at …" prompt;
 *  - periodically persists the current position, and once more as the window
 *    unloads, so the next open can offer to pick up where you left off.
 *
 * The actual position store lives in the main process
 * ({@link FileMetadataStore}); this only reads on load and writes on a timer.
 */
export function useResume(): Resume {
  const filePath = usePlayerStore((s) => selectPlayback(s).filePath)
  const dispatch = usePlayerStore((s) => s.dispatch)
  const [promptSeconds, setPromptSeconds] = useState<number | null>(null)

  // On a new file: register the open (bumps recents, preserves resume pos) and
  // decide whether to offer resuming.
  useEffect(() => {
    setPromptSeconds(null)
    if (!filePath) return
    let active = true
    void window.api.getFileMetadata(filePath).then((meta) => {
      if (!active) return
      window.api.saveResume({ path: filePath, pos: meta?.resumePos ?? 0, duration: 0 })
      if (meta && meta.resumePos > RESUME_MIN_SECONDS) setPromptSeconds(meta.resumePos)
    })
    return () => {
      active = false
    }
  }, [filePath])

  // Auto-dismiss the prompt after a while so it never lingers.
  useEffect(() => {
    if (promptSeconds === null) return
    const timer = setTimeout(() => setPromptSeconds(null), 8000)
    return () => clearTimeout(timer)
  }, [promptSeconds])

  // Persist the position on a timer and a final time as the window unloads.
  useEffect(() => {
    const save = (): void => {
      const { filePath: p, position, duration } = usePlayerStore.getState().state.playback
      if (p) window.api.saveResume({ path: p, pos: position, duration })
    }
    const timer = setInterval(save, SAVE_INTERVAL_MS)
    window.addEventListener('beforeunload', save)
    return () => {
      clearInterval(timer)
      window.removeEventListener('beforeunload', save)
      save()
    }
  }, [])

  return {
    promptSeconds,
    onResume: () => {
      if (promptSeconds !== null) dispatch({ type: 'seekAbsolute', seconds: promptSeconds, precise: true })
      setPromptSeconds(null)
    },
    onDismiss: () => setPromptSeconds(null)
  }
}
