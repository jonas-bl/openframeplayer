import { useSettingsStore } from '../../state/settingsStore'

/**
 * Composition / measurement guide overlay drawn over the video region:
 * rule-of-thirds, an N×N grid, a centre cross, and title/action-safe margins.
 * These are viewport-relative (the standard for framing guides), so they sit in
 * a full-bleed SVG over the video and don't track zoom/pan. Inert
 * (pointer-events-none). Driven by the persisted, cross-window guide settings.
 */
export function GuidesOverlay(): JSX.Element | null {
  const guides = useSettingsStore((s) => s.settings.analysis.guides)
  if (!guides.thirds && !guides.grid && !guides.center && !guides.safe) return null

  const line = 'stroke-white/40'
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      viewBox="0 0 100 100"
    >
      {guides.thirds && (
        <g className={line} strokeWidth={0.2}>
          <line x1={33.33} y1={0} x2={33.33} y2={100} />
          <line x1={66.66} y1={0} x2={66.66} y2={100} />
          <line x1={0} y1={33.33} x2={100} y2={33.33} />
          <line x1={0} y1={66.66} x2={100} y2={66.66} />
        </g>
      )}
      {guides.grid && (
        <g className="stroke-white/25" strokeWidth={0.15}>
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => (
            <line key={`v${p}`} x1={p} y1={0} x2={p} y2={100} />
          ))}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((p) => (
            <line key={`h${p}`} x1={0} y1={p} x2={100} y2={p} />
          ))}
        </g>
      )}
      {guides.center && (
        <g className="stroke-white/60" strokeWidth={0.25}>
          <line x1={48} y1={50} x2={52} y2={50} />
          <line x1={50} y1={48} x2={50} y2={52} />
        </g>
      )}
      {guides.safe && (
        <g className="fill-none stroke-amber-300/50" strokeWidth={0.2}>
          <rect x={5} y={5} width={90} height={90} />
          <rect x={10} y={10} width={80} height={80} />
        </g>
      )}
    </svg>
  )
}
