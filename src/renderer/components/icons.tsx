import type { ReactNode } from 'react'

/**
 * Inline SVG icons. Kept as small local components (no icon dependency) so the
 * bundle stays lean and every glyph is styleable via `currentColor`.
 */
type IconProps = { className?: string; size?: number }

function Svg({
  children,
  className,
  size = 20
}: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export const PlayIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M7 4.5v15l12-7.5-12-7.5Z" fill="currentColor" stroke="none" />
  </Svg>
)

export const PauseIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const StepBackIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M18 6v12l-8.5-6L18 6Z" fill="currentColor" stroke="none" />
    <rect x="6" y="6" width="2" height="12" rx="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const StepForwardIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M6 6v12l8.5-6L6 6Z" fill="currentColor" stroke="none" />
    <rect x="16" y="6" width="2" height="12" rx="1" fill="currentColor" stroke="none" />
  </Svg>
)

export const VolumeIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    <path d="M19 6a8 8 0 0 1 0 12" />
  </Svg>
)

export const MuteIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" stroke="none" />
    <path d="M22 9l-6 6M16 9l6 6" />
  </Svg>
)

export const CameraIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.2" />
  </Svg>
)

export const FlipIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 3v18" strokeDasharray="2 2" />
    <path d="M9 7l-5 5 5 5V7Z" fill="currentColor" stroke="none" />
    <path d="M15 7l5 5-5 5V7Z" />
  </Svg>
)

export const ResetIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 12a8 8 0 1 1 2.3 5.6" />
    <path d="M4 18v-4h4" />
  </Svg>
)

export const ZoomInIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M11 8v6M8 11h6M20 20l-3.5-3.5" />
  </Svg>
)

export const ZoomOutIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M8 11h6M20 20l-3.5-3.5" />
  </Svg>
)

export const GearIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
)

export const FullscreenIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
  </Svg>
)

export const FullscreenExitIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M9 4v4a1 1 0 0 1-1 1H4M15 4v4a1 1 0 0 0 1 1h4M9 20v-4a1 1 0 0 0-1-1H4M15 20v-4a1 1 0 0 1 1-1h4" />
  </Svg>
)

export const PopoutIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-8 8M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
  </Svg>
)

export const NewWindowIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="3" y="4" width="14" height="11" rx="1.5" />
    <path d="M19 13v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2" />
    <path d="M10 9.5h0M10 7v5M7.5 9.5h5" />
  </Svg>
)

export const SpeedIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M5 18a8 8 0 1 1 14 0" />
    <path d="M12 14l4-4" />
    <circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)

export const SlidersIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4" />
    <circle cx="15" cy="6" r="2" fill="currentColor" stroke="none" />
    <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
    <circle cx="14" cy="18" r="2" fill="currentColor" stroke="none" />
  </Svg>
)

export const PenIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 20l4-1L19 8a2 2 0 0 0-3-3L5 16l-1 4Z" />
    <path d="M14.5 6.5l3 3" />
  </Svg>
)

export const LineIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M5 19L19 5" />
  </Svg>
)

export const RectIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <rect x="4" y="6" width="16" height="12" rx="1" />
  </Svg>
)

export const EllipseIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <ellipse cx="12" cy="12" rx="8" ry="6" />
  </Svg>
)

export const ArrowIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M5 19L19 5" />
    <path d="M12 5h7v7" />
  </Svg>
)

export const FocusIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
)

export const TargetLockIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="7" />
    <path d="M5 4H4v1M19 4h1v1M5 20H4v-1M19 20h1v-1" />
  </Svg>
)

export const UndoIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M9 7L4 12l5 5" />
    <path d="M4 12h11a5 5 0 0 1 0 10h-1" />
  </Svg>
)

export const TrashIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </Svg>
)

export const PlusIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

/** Looping arrows (a rounded rectangle of motion with a return arrowhead). */
export const LoopIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M4 9a3 3 0 0 1 3-3h10l-2.5-2.5M20 15a3 3 0 0 1-3 3H7l2.5 2.5" />
  </Svg>
)

/** Reverse playback: two chevrons pointing left. */
export const ReverseIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <path d="M11 7l-5 5 5 5M18 7l-5 5 5 5" />
  </Svg>
)

/** The classic 6-dot drag handle, signalling a component can be moved. */
export const GripIcon = (p: IconProps): JSX.Element => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.4" fill="currentColor" stroke="none" />
  </Svg>
)
