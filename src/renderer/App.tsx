import { useRef } from 'react'
import { usePlayerBridge } from './state/usePlayerBridge'
import { useChromeBridge } from './state/useChromeBridge'
import { useAnnotationBridge } from './state/useAnnotationBridge'
import { usePlayerStore, selectEngine, selectPlayback } from './state/playerStore'
import { useUiStore } from './state/uiStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useWheelShortcuts } from './hooks/useWheelShortcuts'
import { useAutoHideChrome } from './hooks/useAutoHideChrome'
import { useVideoBoundsReporter } from './hooks/useVideoBoundsReporter'
import { useTracking } from './hooks/useTracking'
import { VideoStage } from './components/VideoStage'
import { AnnotationOverlay } from './components/AnnotationOverlay'
import { DrawingToolbar } from './components/DrawingToolbar'
import { useAnnotationStore } from './state/annotationStore'
import { TransportBar } from './components/TransportBar'
import { ErrorBanner } from './components/ErrorBanner'
import { ScreenshotToast } from './components/ScreenshotToast'
import { UpdateToast } from './components/UpdateToast'
import { SettingsModal } from './components/SettingsModal'

/**
 * Application root and layout.
 *
 * The window keeps its native OS frame (title bar, resize borders), so this
 * overlay only renders the content area beneath it. In windowed mode the
 * transport bar is a solid in-flow strip that reserves space, and the embedded
 * mpv video is confined to the region above it (reported via
 * {@link useVideoBoundsReporter}) so chrome never covers the video. In
 * fullscreen the transport bar overlays the video, auto-hiding for an immersive
 * view.
 */
export function App(): JSX.Element {
  usePlayerBridge()
  useChromeBridge()
  useAnnotationBridge()
  useKeyboardShortcuts()
  useWheelShortcuts()

  const engine = usePlayerStore(selectEngine)
  const playback = usePlayerStore(selectPlayback)
  const hasFile = playback.filePath !== null
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const fullscreen = useUiStore((s) => s.fullscreen)
  const popoutOpen = useUiStore((s) => s.popoutOpen)
  const drawMode = useAnnotationStore((s) => s.toolMode === 'draw')
  useTracking(hasFile)

  // Chrome auto-hides in fullscreen and stays hidden when idle even while paused
  // — only pointer/keyboard activity reveals it. In windowed mode it's always present.
  const autoHide = useAutoHideChrome(fullscreen && hasFile)
  const chromeVisible = fullscreen ? autoHide : true

  // When controls are popped out, the player window shows none of them.
  const showControls = hasFile && !popoutOpen && chromeVisible

  const videoRegionRef = useRef<HTMLDivElement>(null)
  useVideoBoundsReporter(videoRegionRef)

  return (
    <div className="relative flex h-full flex-col">

      {engine.error && <ErrorBanner message={engine.error} />}

      {/* The video region: mpv is confined to this rectangle. */}
      <div
        ref={videoRegionRef}
        className={`relative flex-1 overflow-hidden ${chromeVisible ? '' : 'cursor-none'}`}
      >
        <VideoStage hasFile={hasFile} />
        {hasFile && <AnnotationOverlay />}
        {hasFile && drawMode && <DrawingToolbar />}
        <ScreenshotToast />

        {/* In fullscreen the controls overlay the video at the bottom. */}
        {fullscreen && showControls && (
          <div className="absolute inset-x-0 bottom-0">
            <BottomControls />
          </div>
        )}
      </div>

      {/* In windowed mode the controls are solid strips that reserve space. */}
      {!fullscreen && showControls && <BottomControls />}

      {settingsOpen && <SettingsModal />}

      {/* Self-update notice — shown regardless of whether a file is loaded. */}
      <UpdateToast />
    </div>
  )
}

/** The bottom controls: a single bar with the scrubber on top and everything else below. */
function BottomControls(): JSX.Element {
  return <TransportBar />
}
