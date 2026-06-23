/**
 * Pro-mode analysis panels and their persisted settings.
 *
 * Panels live in a right-side dock that can be detached into a separate window
 * (for multi-monitor setups). Which panels are open and their options are
 * persisted in {@link AppSettings} so they sync across windows (and sessions);
 * the dock's detached state is runtime-only (like the controls pop-out).
 */
export type PanelId = 'scopes' | 'measure' | 'frameDiff' | 'adjust'

export const PANEL_IDS: PanelId[] = ['scopes', 'measure', 'frameDiff', 'adjust']

export const PANEL_LABELS: Record<PanelId, string> = {
  scopes: 'Scopes',
  measure: 'Guides',
  frameDiff: 'Frame diff',
  adjust: 'Adjust'
}

/** Composition / measurement guide overlays drawn over the video. */
export interface GuideSettings {
  thirds: boolean
  grid: boolean
  center: boolean
  /** Title/action-safe margin rectangles. */
  safe: boolean
}

/** Onion-skin / frame-difference overlay options. */
export interface FrameDiffSettings {
  /** Reference-frame opacity, 0..1. */
  opacity: number
  /** `ghost` = semi-transparent overlay; `difference` = blended difference. */
  mode: 'ghost' | 'difference'
  /** Whether the onion-skin overlay is engaged. */
  active: boolean
  /**
   * Bumped each time the user pins a new reference. The main window watches this
   * (it changes across windows via the settings broadcast) and captures the
   * current frame locally — so a popped-out panel can drive the overlay without
   * sending image data across windows.
   */
  pinSeq: number
}

export interface AnalysisSettings {
  /** Panels currently shown in the dock. */
  openPanels: PanelId[]
  guides: GuideSettings
  frameDiff: FrameDiffSettings
}

export const DEFAULT_ANALYSIS: AnalysisSettings = {
  openPanels: ['scopes'],
  guides: { thirds: false, grid: false, center: false, safe: false },
  frameDiff: { opacity: 0.5, mode: 'ghost', active: false, pinSeq: 0 }
}

/** Normalises possibly-partial/stale persisted analysis settings onto defaults. */
export function mergeAnalysis(partial: Partial<AnalysisSettings> | null | undefined): AnalysisSettings {
  const open = Array.isArray(partial?.openPanels)
    ? partial!.openPanels.filter((p): p is PanelId => (PANEL_IDS as string[]).includes(p))
    : DEFAULT_ANALYSIS.openPanels
  return {
    openPanels: open,
    guides: { ...DEFAULT_ANALYSIS.guides, ...(partial?.guides ?? {}) },
    frameDiff: {
      opacity: clamp01(partial?.frameDiff?.opacity, DEFAULT_ANALYSIS.frameDiff.opacity),
      mode: partial?.frameDiff?.mode === 'difference' ? 'difference' : 'ghost',
      active: partial?.frameDiff?.active === true,
      pinSeq: typeof partial?.frameDiff?.pinSeq === 'number' ? partial.frameDiff.pinSeq : 0
    }
  }
}

function clamp01(value: unknown, fallback: number): number {
  return typeof value === 'number' && value >= 0 && value <= 1 ? value : fallback
}
