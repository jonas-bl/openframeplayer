import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import {
  PlayIcon,
  SlidersIcon,
  FocusIcon,
  PenIcon,
  ExportIcon,
  LinkIcon,
  GearIcon
} from './icons'

/**
 * First-run feature tour. A short, skippable walkthrough of what makes
 * FramePlayer different — built around its four UI **modes** rather than
 * hotkeys. Shown once (gated by `settings.hasSeenIntro`) and re-openable from
 * the idle screen. Dismissing it — Skip, Esc, finishing, or clicking the
 * backdrop — is the caller's responsibility via {@link onClose}.
 *
 * Each step has a bespoke icon-built hero illustration so it looks complete out
 * of the box. Dropping a matching image into `src/renderer/assets/onboarding/`
 * (see the README there) transparently replaces the illustration.
 */

type IconType = ComponentType<{ size?: number; className?: string }>

/** Optional hero images dropped into assets/onboarding, keyed by filename stem. */
const heroImages = import.meta.glob('../assets/onboarding/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

function heroFor(name: string): string | undefined {
  const hit = Object.entries(heroImages).find(([path]) => path.includes(`/${name}.`))
  return hit?.[1]
}

// --- Hero illustrations (icon-built; shown unless an image overrides them) ---

/** A short column of film-strip perforations, echoing the app icon. */
function Perfs(): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-2.5 w-2.5 rounded-[3px] bg-accent/40" />
      ))}
    </div>
  )
}

function WelcomeHero(): JSX.Element {
  return (
    <div className="flex items-center gap-5">
      <Perfs />
      <div className="flex h-24 w-20 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/30">
        <PlayIcon size={34} className="ml-1 text-accent" />
      </div>
      <Perfs />
    </div>
  )
}

/** Four tiles whose "fullness" steps up across the modes. */
function ModesHero(): JSX.Element {
  const tiles: { label: string; bars: number; gear?: boolean; pro?: boolean }[] = [
    { label: 'Casual', bars: 1 },
    { label: 'Standard', bars: 2 },
    { label: 'Pro', bars: 3, pro: true },
    { label: 'Custom', bars: 0, gear: true }
  ]
  return (
    <div className="flex items-end gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`flex h-20 w-16 flex-col items-center justify-end gap-1 rounded-lg p-2 ring-1 ${
            t.pro ? 'bg-accent/20 ring-accent/40' : 'bg-surface-700/60 ring-surface-500/60'
          }`}
        >
          {t.gear ? (
            <GearIcon size={20} className="mb-1 text-accent" />
          ) : (
            <div className="flex w-full flex-col gap-1">
              {[0, 1, 2].map((b) => (
                <div
                  key={b}
                  className={`h-1.5 rounded-full ${
                    b < t.bars ? 'bg-accent' : 'bg-surface-500/60'
                  }`}
                />
              ))}
            </div>
          )}
          <span className="text-[10px] font-medium text-zinc-400">{t.label}</span>
        </div>
      ))}
    </div>
  )
}

/** A waveform-ish scope panel with a crosshair, standing in for the analysis dock. */
function AnalysisHero(): JSX.Element {
  const bars = [10, 18, 14, 24, 30, 22, 34, 26, 16, 20, 12, 28]
  return (
    <div className="relative flex h-24 w-48 items-end gap-1 rounded-lg bg-surface-900/70 p-3 ring-1 ring-surface-500/50">
      {bars.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-sm bg-accent/70"
          style={{ height: `${(h / 34) * 100}%` }}
        />
      ))}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-accent/40" />
        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-accent/40" />
      </div>
    </div>
  )
}

function AnnotateHero(): JSX.Element {
  return (
    <div className="relative flex h-24 w-44 items-center justify-center rounded-lg bg-surface-900/70 ring-1 ring-surface-500/50">
      {/* Freehand stroke. */}
      <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full">
        <path
          d="M28 60 q14 -34 30 -12 q12 16 26 -8 q10 -16 24 4"
          fill="none"
          stroke="#5b8cff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      {/* Autofocus box. */}
      <div className="absolute right-6 top-5 h-9 w-9 rounded-md border-2 border-dashed border-accent/70" />
      <div className="absolute -bottom-3 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-accent text-white ring-4 ring-surface-800">
        <PenIcon size={16} />
      </div>
    </div>
  )
}

function ExportHero(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-surface-900/70 ring-1 ring-surface-500/50">
        <ExportIcon size={26} className="text-accent" />
      </div>
      <div className="flex gap-2">
        {['MP4', 'GIF', 'PNG'].map((f) => (
          <span
            key={f}
            className="rounded-md bg-surface-700/70 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 ring-1 ring-surface-500/50"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}

function CompareHero(): JSX.Element {
  return (
    <div className="relative flex items-center">
      <div className="z-10 flex h-20 w-28 -rotate-3 items-center justify-center rounded-lg bg-surface-700/80 ring-1 ring-surface-500/60">
        <PlayIcon size={22} className="ml-0.5 text-zinc-400" />
      </div>
      <div className="-ml-6 flex h-20 w-28 rotate-3 items-center justify-center rounded-lg bg-surface-700/80 ring-1 ring-surface-500/60">
        <PlayIcon size={22} className="ml-0.5 text-zinc-400" />
      </div>
      <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white ring-4 ring-surface-800">
        <LinkIcon size={16} />
      </div>
    </div>
  )
}

interface ModeRow {
  name: string
  blurb: string
}

interface Step {
  icon: IconType
  title: string
  body: string
  /** Default icon-built illustration. */
  hero: ReactNode
  /** Image filename stem under assets/onboarding (without extension); overrides the hero. */
  image: string
  /** Optional bulleted rows (used by the modes step). */
  modes?: ModeRow[]
}

const STEPS: Step[] = [
  {
    icon: PlayIcon,
    title: 'Welcome to FramePlayer',
    body: 'A player built for looking closely. Scrub frame by frame, zoom right into the pixels, and study footage the way an editor or VFX artist needs to — not just press play.',
    hero: <WelcomeHero />,
    image: '01-welcome'
  },
  {
    icon: SlidersIcon,
    title: 'One app, four modes',
    body: 'FramePlayer adapts to how much you need on screen. Switch modes any time — every feature stays available, the mode just decides what’s shown.',
    hero: <ModesHero />,
    image: '02-modes',
    modes: [
      { name: 'Casual', blurb: 'Just the essentials — play, seek, volume, speed.' },
      { name: 'Standard', blurb: 'The full everyday player (the default).' },
      { name: 'Pro', blurb: 'Adds the analysis toolkit: scopes, measurement, frame-diff, comparison, export.' },
      { name: 'Custom', blurb: 'Hand-pick exactly the tools you want visible.' }
    ]
  },
  {
    icon: FocusIcon,
    title: 'Analyse every frame',
    body: 'Pro mode unlocks real inspection tools: waveform & histogram scopes, on-screen measurement guides, an A/B frame-diff overlay, and side-by-side comparison of two clips with linked playback.',
    hero: <AnalysisHero />,
    image: '03-analysis'
  },
  {
    icon: PenIcon,
    title: 'Draw, mark & follow the action',
    body: 'Sketch notes straight onto the video and drop markers at key moments. Autofocus can lock onto a subject and keep it centred as it moves across the frame.',
    hero: <AnnotateHero />,
    image: '04-annotate'
  },
  {
    icon: ExportIcon,
    title: 'Capture and share',
    body: 'Grab lossless screenshots and polish them in the built-in editor — including AI upscale and enhance. Loop any A–B range (even in reverse), then export a clip, GIF, or PNG sequence of exactly the part you care about.',
    hero: <ExportHero />,
    image: '05-export'
  },
  {
    icon: LinkIcon,
    title: 'Compare side by side',
    body: 'Open as many windows as you like and link their transport to play multiple cuts in perfect sync. Pick a mode, open a file, and dive in.',
    hero: <CompareHero />,
    image: '06-compare'
  }
]

/** The hero area: a dropped-in image if present, otherwise the icon illustration. */
function Hero({ image, illustration }: { image: string; illustration: ReactNode }): JSX.Element {
  const src = heroFor(image)
  return (
    <div className="onboard-hero relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-accent-muted/25 to-surface-900">
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : illustration}
    </div>
  )
}

export function Onboarding({ onClose }: { onClose: () => void }): JSX.Element {
  const [index, setIndex] = useState(0)
  const step = STEPS[index]
  const isLast = index === STEPS.length - 1

  // Esc skips the whole tour; arrows page through it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, STEPS.length - 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-[150] flex items-center justify-center bg-surface-900/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-surface-600 bg-surface-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hero — re-keyed so it animates on each step. */}
        <div className="relative">
          <Hero key={`hero-${index}`} image={step.image} illustration={step.hero} />
          <div className="absolute right-3 top-3">
            <button
              onClick={onClose}
              className="rounded-md bg-surface-900/60 px-2.5 py-1 text-xs text-zinc-300 backdrop-blur transition-colors hover:bg-surface-900/90 hover:text-zinc-100"
            >
              Skip
            </button>
          </div>
          <div className="absolute left-3 top-3 rounded-md bg-surface-900/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-300 backdrop-blur">
            {index + 1} / {STEPS.length}
          </div>
        </div>

        {/* Body — re-keyed so the content animates in on each step. */}
        <div key={`body-${index}`} className="onboard-step px-6 pb-2 pt-5">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-50">{step.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>

          {step.modes && (
            <ul className="mt-4 space-y-2">
              {step.modes.map((m, i) => (
                <li
                  key={m.name}
                  className="onboard-row flex gap-3 rounded-lg bg-surface-700/50 px-3 py-2"
                  style={{ animationDelay: `${0.12 + i * 0.08}s` }}
                >
                  <span className="shrink-0 text-sm font-semibold text-accent">{m.name}</span>
                  <span className="text-sm text-zinc-400">{m.blurb}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-surface-700 px-6 py-4">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-5 bg-accent' : 'w-1.5 bg-surface-500 hover:bg-surface-500/70'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-surface-700"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-colors hover:bg-accent-hover"
            >
              {isLast ? 'Get started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
