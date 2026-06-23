import type { AppMode } from './settings'

/**
 * The single source of truth for which control groups each UI mode reveals.
 *
 * The tiered modes (casual < standard < pro) gate *visibility only* — every
 * capability remains reachable via its keybinding regardless of mode. A feature
 * shows when the current mode is at least as high as its minimum tier. The
 * `custom` mode ignores tiers entirely and uses the per-feature switches the
 * user sets in settings (see {@link isFeatureVisible}).
 *
 * Anything not listed here is always-on (the bare essentials: play/pause, seek,
 * volume, fullscreen, settings).
 */
export const FEATURES = [
  'speed',
  'frameStep',
  'frameCounter',
  'drawTools',
  'imagePanel',
  'newWindow',
  'loop',
  'screenshot',
  'popout',
  'tracks',
  'playlist',
  'markers',
  'export',
  'goToFrame',
  'measure',
  'scopes',
  'frameDiff',
  'frameExport',
  'comparison'
] as const

export type Feature = (typeof FEATURES)[number]

/** Custom mode reuses the standard rank slot; the tier path never reads it. */
const RANK: Record<AppMode, number> = { casual: 0, standard: 1, pro: 2, custom: 1 }

/** Minimum tier at which each feature becomes visible (for the tiered modes). */
const MIN_MODE: Record<Feature, AppMode> = {
  // Casual essentials — visible in every tiered mode.
  speed: 'casual',
  tracks: 'casual',
  playlist: 'casual',
  // Standard everyday player.
  frameStep: 'standard',
  frameCounter: 'standard',
  drawTools: 'standard',
  imagePanel: 'standard',
  newWindow: 'standard',
  loop: 'standard',
  screenshot: 'standard',
  popout: 'standard',
  markers: 'standard',
  export: 'standard',
  // Pro analysis tools.
  goToFrame: 'pro',
  measure: 'pro',
  scopes: 'pro',
  frameDiff: 'pro',
  frameExport: 'pro',
  comparison: 'pro'
}

/** Friendly labels for the custom-mode toggle list. */
export const FEATURE_LABELS: Record<Feature, string> = {
  speed: 'Playback speed',
  frameStep: 'Frame stepping',
  frameCounter: 'Frame counter',
  drawTools: 'Drawing tools',
  imagePanel: 'Image controls (zoom, flip, rotate)',
  newWindow: 'New-window button',
  loop: 'Looping (A-B / whole file)',
  screenshot: 'Screenshot',
  popout: 'Pop-out controls',
  tracks: 'Subtitle / audio tracks',
  playlist: 'Playlist',
  markers: 'Markers',
  export: 'Export (clip / GIF)',
  goToFrame: 'Go to frame',
  measure: 'Measurement guides',
  scopes: 'Colour scopes',
  frameDiff: 'Frame diff / onion-skin',
  frameExport: 'Frame-sequence export',
  comparison: 'Compare (link windows)'
}

/** True when a feature shows at the given tier (tiered modes only). */
export function isVisible(feature: Feature, mode: AppMode): boolean {
  return RANK[mode] >= RANK[MIN_MODE[feature]]
}

/**
 * Per-feature defaults for custom mode — seeded from the Standard tier, so
 * switching into custom starts from a familiar everyday layout the user then
 * tweaks.
 */
export const DEFAULT_CUSTOM_FEATURES: Record<Feature, boolean> = buildCustomDefaults()

function buildCustomDefaults(): Record<Feature, boolean> {
  const out = {} as Record<Feature, boolean>
  for (const feature of FEATURES) out[feature] = isVisible(feature, 'standard')
  return out
}

/**
 * Whether `feature` should be shown given the current `mode` and (for custom
 * mode) the user's per-feature switches. The single visibility check used by
 * the whole UI — in custom mode it consults `custom`, otherwise it uses tiers.
 */
export function isFeatureVisible(
  feature: Feature,
  mode: AppMode,
  custom: Partial<Record<Feature, boolean>>
): boolean {
  if (mode === 'custom') return custom[feature] ?? DEFAULT_CUSTOM_FEATURES[feature]
  return isVisible(feature, mode)
}
