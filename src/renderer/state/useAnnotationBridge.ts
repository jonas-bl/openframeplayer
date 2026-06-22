import { useEffect } from 'react'
import type { AnnotationControl } from '@shared/annotation'
import { useAnnotationStore } from './annotationStore'

/** The synced subset of the annotation store. */
function pickControl(s: ReturnType<typeof useAnnotationStore.getState>): AnnotationControl {
  return {
    toolMode: s.toolMode,
    tool: s.tool,
    color: s.color,
    strokeWidth: s.strokeWidth,
    drawAnchor: s.drawAnchor,
    keepCentered: s.keepCentered
  }
}

/** The control fields that differ between two snapshots. */
function diffControl(
  prev: AnnotationControl,
  next: AnnotationControl
): Partial<AnnotationControl> {
  const patch: Partial<AnnotationControl> = {}
  for (const key of Object.keys(next) as (keyof AnnotationControl)[]) {
    if (prev[key] !== next[key]) (patch[key] as AnnotationControl[typeof key]) = next[key]
  }
  return patch
}

/**
 * Shares the annotation *control* state across the player window group, so
 * toggling draw / autofocus / colour / width in the pop-out controls drives the
 * video overlay (and vice-versa). Seeds from the group's current state, pushes
 * local changes to the main process, and applies remote patches without echoing
 * them back. Mount once in each player view (the main App and the pop-out); the
 * screenshot editor deliberately does NOT mount it, keeping its tools local.
 */
export function useAnnotationBridge(): void {
  useEffect(() => {
    let active = true
    let applyingRemote = false
    let prev = pickControl(useAnnotationStore.getState())

    const applyRemote = (patch: Partial<AnnotationControl>): void => {
      applyingRemote = true
      useAnnotationStore.getState().applyControl(patch)
      prev = pickControl(useAnnotationStore.getState())
      applyingRemote = false
    }

    void window.api.getAnnotationControl().then((c) => active && applyRemote(c))

    const unsub = useAnnotationStore.subscribe((state) => {
      if (applyingRemote) return
      const next = pickControl(state)
      const patch = diffControl(prev, next)
      prev = next
      if (Object.keys(patch).length > 0) window.api.setAnnotationControl(patch)
    })

    const off = window.api.onAnnotationControlChanged(applyRemote)

    return () => {
      active = false
      unsub()
      off()
    }
  }, [])
}
