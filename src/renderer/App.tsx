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
import { ExportToast } from './components/ExportToast'
import { ResumeToast } from './components/ResumeToast'
import { PanelDock } from './components/PanelDock'
import { GuidesOverlay } from './components/overlays/GuidesOverlay'
import { FrameDiffOverlay } from './components/overlays/FrameDiffOverlay'
import { useResume } from './hooks/useResume'
import { useFeatureVisible } from './hooks/useMode'
import { useMarkersStore } from './state/markersStore'
import { useEffect } from 'react'
import { UpdateToast } from './components/UpdateToast'
import { SettingsModal } from './components/SettingsModal'
import { StartupOverlay } from './components/StartupOverlay'

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
  const panelPopoutOpen = useUiStore((s) => s.panelPopoutOpen)
  const showScopes = useFeatureVisible('scopes')
  const showMeasure = useFeatureVisible('measure')
  const showFrameDiff = useFeatureVisible('frameDiff')
  const drawMode = useAnnotationStore((s) => s.toolMode === 'draw')
  useTracking(hasFile)
  const resume = useResume()

  // Load this file's persisted markers whenever the file changes.
  const loadMarkers = useMarkersStore((s) => s.load)
  useEffect(() => loadMarkers(playback.filePath), [playback.filePath, loadMarkers])

  // Chrome auto-hides in fullscreen and stays hidden when idle even while paused
  // — only pointer/keyboard activity reveals it. In windowed mode it's always present.
  const autoHide = useAutoHideChrome(fullscreen && hasFile)
  const chromeVisible = fullscreen ? autoHide : true

  // When controls are popped out, the player window shows none of them.
  const showControls = hasFile && !popoutOpen && chromeVisible
  // The analysis dock sits to the right of the video whenever any analysis panel
  // is enabled (all of them in Pro; a custom subset in Custom mode), unless it's
  // detached into its own window or we're in immersive fullscreen.
  const showDock =
    hasFile && (showScopes || showMeasure || showFrameDiff) && !panelPopoutOpen && !fullscreen

  const videoRegionRef = useRef<HTMLDivElement>(null)
  useVideoBoundsReporter(videoRegionRef)

  return (
    <div className="relative flex h-full flex-col">

      {engine.error && <ErrorBanner message={engine.error} />}

      {/* Video + optional right-side analysis dock. */}
      <div className="flex min-h-0 flex-1">
        {/* The video region: mpv is confined to this rectangle. */}
        <div
          ref={videoRegionRef}
          className={`relative min-w-0 flex-1 overflow-hidden ${chromeVisible ? '' : 'cursor-none'}`}
        >
          <VideoStage hasFile={hasFile} />
          {hasFile && showFrameDiff && <FrameDiffOverlay />}
          {hasFile && showMeasure && <GuidesOverlay />}
          {hasFile && <AnnotationOverlay />}
          {hasFile && drawMode && <DrawingToolbar />}
          <ScreenshotToast />
          <ExportToast />
          {hasFile && resume.promptSeconds !== null && (
            <ResumeToast
              seconds={resume.promptSeconds}
              onResume={resume.onResume}
              onDismiss={resume.onDismiss}
            />
          )}

          {/* In fullscreen the controls overlay the video at the bottom. */}
          {fullscreen && showControls && (
            <div className="absolute inset-x-0 bottom-0">
              <BottomControls />
            </div>
          )}
        </div>

        {showDock && (
          <aside className="w-72 shrink-0 border-l border-surface-700">
            <PanelDock />
          </aside>
        )}
      </div>

      {/* In windowed mode the controls are solid strips that reserve space. */}
      {!fullscreen && showControls && <BottomControls />}

      {settingsOpen && <SettingsModal />}

      {/* Self-update notice — shown regardless of whether a file is loaded. */}
      <UpdateToast />

      {/* Animated start screen + first-run feature tour. */}
      <StartupOverlay />
    </div>
  )
}

/** The bottom controls: a single bar with the scrubber on top and everything else below. */
function BottomControls(): JSX.Element {
  return <TransportBar />
}
