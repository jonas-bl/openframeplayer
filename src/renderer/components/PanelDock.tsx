import type { ReactNode } from 'react'
import { PANEL_LABELS, type PanelId } from '@shared/panels'
import type { Feature } from '@shared/featureVisibility'
import { useSettingsStore } from '../state/settingsStore'
import { useFeatureVisible } from '../hooks/useMode'
import { PopoutIcon } from './icons'
import { ScopesPanel } from './panels/ScopesPanel'
import { MeasurePanel } from './panels/MeasurePanel'
import { FrameDiffPanel } from './panels/FrameDiffPanel'
import { AdjustPanel } from './panels/AdjustPanel'

/**
 * Registry of implemented analysis panels. Drives both the show/hide chips and
 * the rendered body, so adding a panel is one entry here.
 */
const PANELS: { id: PanelId; render: () => ReactNode }[] = [
  { id: 'scopes', render: () => <ScopesPanel /> },
  { id: 'measure', render: () => <MeasurePanel /> },
  { id: 'frameDiff', render: () => <FrameDiffPanel /> },
  { id: 'adjust', render: () => <AdjustPanel /> }
]

/** The feature switch that governs each panel (so Custom mode can hide them). */
const PANEL_FEATURE: Record<PanelId, Feature> = {
  scopes: 'scopes',
  measure: 'measure',
  frameDiff: 'frameDiff',
  adjust: 'imagePanel'
}

/**
 * The Pro analysis-panel dock. Hosts a row of show/hide chips plus the body of
 * each open panel. Renders the same whether docked on the right of the main
 * window or inside the detached pop-out window (`detached`); only the docked
 * version shows the "pop out" button (the floating window has its own close).
 */
export function PanelDock({ detached = false }: { detached?: boolean }): JSX.Element {
  const openPanels = useSettingsStore((s) => s.settings.analysis.openPanels)
  const togglePanel = useSettingsStore((s) => s.togglePanel)

  // Only offer panels whose governing feature is visible in the current mode.
  const featureVisible: Record<PanelId, boolean> = {
    scopes: useFeatureVisible(PANEL_FEATURE.scopes),
    measure: useFeatureVisible(PANEL_FEATURE.measure),
    frameDiff: useFeatureVisible(PANEL_FEATURE.frameDiff),
    adjust: useFeatureVisible(PANEL_FEATURE.adjust)
  }
  const panels = PANELS.filter((p) => featureVisible[p.id])

  return (
    <div className="flex h-full w-full flex-col bg-surface-800/95">
      <div className="flex items-center gap-1 border-b border-surface-700 px-2 py-1.5">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Panels
        </span>
        <div className="flex flex-wrap gap-1">
          {panels.map(({ id }) => {
            const active = openPanels.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => togglePanel(id)}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  active
                    ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
                    : 'text-zinc-400 hover:bg-surface-700 hover:text-zinc-200'
                }`}
              >
                {PANEL_LABELS[id]}
              </button>
            )
          })}
        </div>
        {!detached && (
          <button
            type="button"
            aria-label="Pop out panels"
            title="Pop out panels to a separate window"
            onClick={() => window.api.setPanelPopout(true)}
            className="ml-auto rounded-md p-1 text-zinc-400 hover:bg-surface-700 hover:text-zinc-200"
          >
            <PopoutIcon size={15} />
          </button>
        )}
      </div>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-2.5">
        {panels.filter((p) => openPanels.includes(p.id)).map(({ id, render }) => (
          <section key={id}>
            <h3 className="mb-1.5 text-xs font-medium text-zinc-300">{PANEL_LABELS[id]}</h3>
            {render()}
          </section>
        ))}
        {openPanels.length === 0 && (
          <p className="px-1 pt-2 text-xs text-zinc-500">
            No panels open. Use the chips above to show scopes and analysis tools.
          </p>
        )}
      </div>
    </div>
  )
}
