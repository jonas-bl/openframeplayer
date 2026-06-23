import { usePlayerBridge } from '../state/usePlayerBridge'
import { useChromeBridge } from '../state/useChromeBridge'
import { PanelDock } from './PanelDock'
import { WindowButtons } from './WindowButtons'

/**
 * Root of the detached analysis-panel window (`?view=panels`). Shares the player
 * state + settings over IPC, so the panels stay in sync with the main window and
 * its analysis options. The top strip is a native drag region; the × returns the
 * dock to the main window.
 */
export function PanelsView(): JSX.Element {
  usePlayerBridge()
  useChromeBridge()

  return (
    <div className="relative flex h-full flex-col bg-surface-800 text-zinc-100">
      <div className="app-drag flex h-7 shrink-0 items-center justify-between pl-3">
        <span className="text-[11px] font-medium tracking-wide text-zinc-400">Panels</span>
        <WindowButtons height={28} onClose={() => window.api.setPanelPopout(false)} />
      </div>
      <div className="app-no-drag flex-1 overflow-hidden">
        <PanelDock detached />
      </div>
    </div>
  )
}
