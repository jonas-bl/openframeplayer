/**
 * Animated start screen shown briefly on launch (orchestrated by
 * {@link import('./StartupOverlay').StartupOverlay}). It rebuilds the app icon
 * from its parts — the film-strip perforations slide in, the inner frame scales
 * up, and the play glyph pops with a soft pulsing glow — then the wordmark
 * rises. Purely decorative; all animation lives in styles/index.css.
 */

/** Vertical centres of the five film perforations down each side. */
const PERF_ROWS = [40, 80, 120, 160, 200]

export function SplashScreen({ leaving }: { leaving: boolean }): JSX.Element {
  return (
    <div
      className={`splash-root absolute inset-0 z-[200] flex flex-col items-center justify-center gap-8 bg-surface-900 ${
        leaving ? 'splash-leaving' : ''
      }`}
      aria-hidden
    >
      <svg
        className="splash-logo"
        width={132}
        height={132}
        viewBox="0 0 240 240"
        fill="none"
        role="img"
      >
        <defs>
          <linearGradient id="splash-bg" x1="0" y1="0" x2="240" y2="240" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5183ff" />
            <stop offset="1" stopColor="#2f63f5" />
          </linearGradient>
        </defs>

        {/* Rounded-square backdrop. */}
        <rect x="12" y="12" width="216" height="216" rx="50" fill="url(#splash-bg)" />

        {/* Inner film frame. */}
        <rect
          className="splash-frame"
          x="78"
          y="46"
          width="84"
          height="148"
          rx="16"
          fill="#ffffff"
          fillOpacity="0.18"
        />

        {/* Film perforations down both edges. */}
        {PERF_ROWS.map((cy, i) => (
          <g key={cy}>
            <rect
              className="splash-perf splash-perf-left"
              style={{ animationDelay: `${0.12 + i * 0.06}s` }}
              x="33"
              y={cy - 12}
              width="24"
              height="24"
              rx="7"
              fill="#eef2ff"
            />
            <rect
              className="splash-perf splash-perf-right"
              style={{ animationDelay: `${0.12 + i * 0.06}s` }}
              x="183"
              y={cy - 12}
              width="24"
              height="24"
              rx="7"
              fill="#eef2ff"
            />
          </g>
        ))}

        {/* Play glyph (optically centred a touch to the right). */}
        <g className="splash-play">
          <path className="splash-glow" d="M110 90 L110 150 L154 120 Z" fill="#ffffff" />
        </g>
      </svg>

      <div className="flex flex-col items-center gap-1.5">
        <div className="splash-wordmark text-3xl font-semibold tracking-tight">
          <span className="text-zinc-50">Frame</span>
          <span className="text-accent">Player</span>
        </div>
        <div className="splash-tagline text-sm text-zinc-400">Frame-accurate video review</div>
      </div>
    </div>
  )
}
