import { EmptyState } from './EmptyState'
import { useVideoGestures } from '../hooks/useVideoGestures'

/**
 * The central stage over the embedded video.
 *
 * With no media it hosts the idle {@link EmptyState}. With media it is a
 * transparent surface (the frame shows through) that handles the video gestures
 * — drag to pan, wheel to zoom, click to toggle play/pause.
 */
export function VideoStage({ hasFile }: { hasFile: boolean }): JSX.Element {
  const gestures = useVideoGestures()

  if (!hasFile) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState />
      </div>
    )
  }

  return <div className="h-full w-full cursor-grab active:cursor-grabbing" {...gestures} aria-label="Video" />
}
