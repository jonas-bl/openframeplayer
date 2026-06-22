import { usePlayerBridge } from '../state/usePlayerBridge'
import { useAnnotationBridge } from '../state/useAnnotationBridge'
import { useChromeBridge } from '../state/useChromeBridge'
import { useUiStore } from '../state/uiStore'
import { TransportBar } from './TransportBar'
import { WindowButtons } from './WindowButtons'
import { SettingsModal } from './SettingsModal'

/**
 * The pop-out controls window's root. When the controls are popped out, ALL of
 * them live here — transport, the image-correction panel, and the settings
 * modal — and the player window shows none. Synced to the same player state and
 * settings over IPC. The top strip is a native drag region; the × closes the
 * pop-out (returning controls to the player window). Only the player-window
 * chrome (fullscreen / pop-out toggle) is omitted from the action bar here.
 */
export function ControlsView(): JSX.Element {
  usePlayerBridge()
  useAnnotationBridge()
  // Seeds + syncs the full settings store so the in-window settings modal works.
  useChromeBridge()

  const settingsOpen = useUiStore((s) => s.settingsOpen)

  return (
    <div className="relative flex h-full flex-col bg-surface-800 text-zinc-100">
      <div className="app-drag flex h-7 shrink-0 items-center justify-between pl-3">
        <span className="text-[11px] font-medium tracking-wide text-zinc-400">Controls</span>
        <WindowButtons height={28} onClose={() => window.api.setControlsPopout(false)} />
      </div>

      <div className="app-no-drag flex flex-1 flex-col overflow-y-auto scrollbar-thin">
        <TransportBar showWindowActions={false} />
      </div>

      {settingsOpen && <SettingsModal />}
    </div>
  )
}
