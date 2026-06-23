import { useEffect, useRef, useState } from 'react'
import type { ThumbnailSheet } from '@shared/ipc'

/**
 * Fetches the seek-bar thumbnail sheet for the current file once its duration is
 * known. The main process builds it lazily and caches it, so this fires a single
 * request per file. Returns null until ready (or when generation fails).
 */
export function useThumbnails(filePath: string | null, duration: number): ThumbnailSheet | null {
  const [sheet, setSheet] = useState<ThumbnailSheet | null>(null)
  const fetchedFor = useRef<string | null>(null)

  // Reset when the file changes.
  useEffect(() => {
    setSheet(null)
    fetchedFor.current = null
  }, [filePath])

  // Fetch once duration is known (needed to space the frames).
  useEffect(() => {
    if (!filePath || duration <= 0 || fetchedFor.current === filePath) return
    fetchedFor.current = filePath
    let active = true
    void window.api.getThumbnailSheet(filePath, duration).then((s) => {
      if (active) setSheet(s)
    })
    return () => {
      active = false
    }
  }, [filePath, duration])

  return sheet
}
