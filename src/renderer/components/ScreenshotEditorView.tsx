import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent
} from 'react'
import { IconButton } from './IconButton'
import { Slider } from './Slider'
import { WindowButtons } from './WindowButtons'
import { Shape, drawShapeToCanvas, type ShapeData } from './shapes'
import {
  PenIcon,
  LineIcon,
  RectIcon,
  EllipseIcon,
  ArrowIcon,
  UndoIcon,
  TrashIcon,
  ZoomInIcon,
  ZoomOutIcon,
  ResetIcon
} from './icons'
import { DRAW_COLORS, type DrawTool } from '../state/annotationStore'
import type { Vec2 } from '../lib/videoTransform'
import type { EditorPayload } from '@shared/ipc'
import { UPSCALE_MODELS, UPSCALE_MODEL_IDS, type UpscaleModelId } from '@shared/upscale'
import type { UpscaleBackend } from '@shared/ipc'
import {
  ENHANCE_PROMPT,
  IMAGE_PROVIDERS,
  type ImageOp,
  type ImageProviderId
} from '@shared/imageGen'
import type { AppSettings } from '@shared/settings'
import { loadUpscaleModel, runUpscale, type Rect } from '../upscale/runUpscale'

/** `pan` moves the view; `select` marks a region; the rest draw shapes. */
type EditorTool = 'pan' | 'select' | DrawTool

const DRAW_TOOLS: { tool: DrawTool; label: string; Icon: typeof PenIcon }[] = [
  { tool: 'pen', label: 'Freehand', Icon: PenIcon },
  { tool: 'line', label: 'Line', Icon: LineIcon },
  { tool: 'rect', label: 'Rectangle', Icon: RectIcon },
  { tool: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { tool: 'arrow', label: 'Arrow', Icon: ArrowIcon }
]
const WIDTHS = [2, 4, 8]
const CLICK_THRESHOLD_PX = 4
const MIN_SCALE = 0.1
const MAX_SCALE = 16

/** Image-correction values; percentages (100 = neutral), hue in degrees. */
interface Adjustments {
  saturation: number
  brightness: number
  contrast: number
  hue: number
  grayscale: boolean
}

const NEUTRAL: Adjustments = {
  saturation: 100,
  brightness: 100,
  contrast: 100,
  hue: 0,
  grayscale: false
}

function filterString(a: Adjustments): string {
  return [
    `saturate(${a.saturation / 100})`,
    `brightness(${a.brightness / 100})`,
    `contrast(${a.contrast / 100})`,
    `hue-rotate(${a.hue}deg)`,
    `grayscale(${a.grayscale ? 1 : 0})`
  ].join(' ')
}

interface View {
  scale: number
  tx: number
  ty: number
}

/**
 * Root of the screenshot-editor window (`?view=editor`). Loads the captured
 * frame, lets the user adjust colour, draw, and zoom/pan, then bakes everything
 * into a full-resolution PNG and saves it (default folder or a custom path).
 *
 * Self-contained local state — it does not touch the live player/annotation
 * stores, since it edits a still image rather than the running video.
 */
export function ScreenshotEditorView(): JSX.Element {
  const [payload, setPayload] = useState<EditorPayload | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [adjust, setAdjust] = useState<Adjustments>(NEUTRAL)
  const [tool, setTool] = useState<EditorTool>('pan')
  const [color, setColor] = useState<string>(DRAW_COLORS[0])
  const [strokeWidth, setStrokeWidth] = useState<number>(4)
  const [annotations, setAnnotations] = useState<ShapeData[]>([])
  const [draft, setDraft] = useState<ShapeData | null>(null)
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 })
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Upscaling: chosen model (defaults to the persisted setting), the in-progress
  // marquee while picking an area, and download/inference progress.
  const [modelId, setModelId] = useState<UpscaleModelId>(UPSCALE_MODEL_IDS[0])
  const [selDraft, setSelDraft] = useState<Rect | null>(null)
  const [upStage, setUpStage] = useState<string | null>(null)
  const [upPct, setUpPct] = useState<number | null>(null)
  // Live preview of the output being assembled tile-by-tile, plus the tile
  // currently being processed (output-pixel coords) and the bound backend.
  const [upCanvas, setUpCanvas] = useState<HTMLCanvasElement | null>(null)
  const [upOut, setUpOut] = useState<{ w: number; h: number } | null>(null)
  const [activeTile, setActiveTile] = useState<Rect | null>(null)
  const [upBackend, setUpBackend] = useState<UpscaleBackend | null>(null)
  const upBusy = upStage !== null

  // AI image (bring-your-own-key): the configured provider, whether its key is
  // set, the regenerate prompt, and the in-flight stage label.
  const [aiProvider, setAiProvider] = useState<ImageProviderId>('openai')
  const [aiKeyReady, setAiKeyReady] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiStage, setAiStage] = useState<string | null>(null)
  const aiBusy = aiStage !== null

  const viewportRef = useRef<HTMLDivElement>(null)
  const upHostRef = useRef<HTMLDivElement>(null)
  const interaction = useRef<{
    startPx: Vec2
    moved: boolean
    panStart?: View
    selStart?: Vec2
  } | null>(null)

  // Fetch the captured image and decode it.
  useEffect(() => {
    let cancelled = false
    void window.api.getScreenshotEditorPayload().then((p) => {
      if (cancelled || !p) return
      setPayload(p)
      const image = new Image()
      image.onload = () => !cancelled && setImg(image)
      image.src = p.image
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Adopt the user's default upscale model as the initial choice.
  useEffect(() => {
    let cancelled = false
    void window.api.getSettings().then((s) => {
      if (!cancelled) setModelId(s.upscaleModel)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Track the configured AI provider + whether its key is set (live, so adding a
  // key in Settings enables the buttons without reopening the editor).
  useEffect(() => {
    let active = true
    const apply = (s: AppSettings): void => {
      if (!active) return
      setAiProvider(s.imageProvider)
      setAiKeyReady(Boolean((s.imageApiKeys[s.imageProvider] ?? '').trim()))
    }
    void window.api.getSettings().then(apply)
    const off = window.api.onSettingsChanged(apply)
    return () => {
      active = false
      off()
    }
  }, [])

  // Mount the live output canvas into the preview overlay (imperative, since
  // the canvas is created by runUpscale and drawn into directly).
  useEffect(() => {
    const host = upHostRef.current
    if (!host) return
    host.replaceChildren()
    if (upCanvas) {
      upCanvas.className = 'h-full w-full'
      host.appendChild(upCanvas)
    }
  }, [upCanvas])

  /** Scales the image to fit the viewport and centres it. */
  const fit = useCallback((): void => {
    const vp = viewportRef.current
    if (!vp || !img) return
    const scale = Math.min(vp.clientWidth / img.naturalWidth, vp.clientHeight / img.naturalHeight)
    setView({
      scale,
      tx: (vp.clientWidth - img.naturalWidth * scale) / 2,
      ty: (vp.clientHeight - img.naturalHeight * scale) / 2
    })
  }, [img])

  // Fit once the image is ready.
  useEffect(() => {
    if (img) fit()
  }, [img, fit])

  // Esc exits fullscreen if we're in it, otherwise closes the window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      // Cancel an active area-selection before falling through to close/exit.
      if (tool === 'select') {
        setTool('pan')
        setSelDraft(null)
        return
      }
      void window.windowControls.isFullscreen().then((full) => {
        if (full) window.windowControls.toggleFullscreen()
        else window.api.closeScreenshotEditor()
      })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tool])

  /** Pointer position → image-pixel coordinates under the current view. */
  const toImage = (e: ReactPointerEvent): Vec2 => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - view.tx) / view.scale,
      y: (e.clientY - rect.top - view.ty) / view.scale
    }
  }

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const k = scale / v.scale
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
    })
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (upBusy || aiBusy) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const panning = tool === 'pan' || e.button === 1
    const selecting = tool === 'select' && e.button !== 1
    const start = toImage(e)
    interaction.current = {
      startPx: { x: e.clientX, y: e.clientY },
      moved: false,
      panStart: panning ? view : undefined,
      selStart: selecting ? start : undefined
    }
    if (selecting) setSelDraft({ x: start.x, y: start.y, w: 0, h: 0 })
    else if (!panning) {
      setDraft({ tool: tool as DrawTool, color, width: strokeWidth, points: [start] })
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const it = interaction.current
    if (!it) return
    if (Math.hypot(e.clientX - it.startPx.x, e.clientY - it.startPx.y) >= CLICK_THRESHOLD_PX) {
      it.moved = true
    }

    if (it.panStart) {
      const dx = e.clientX - it.startPx.x
      const dy = e.clientY - it.startPx.y
      setView({ scale: it.panStart.scale, tx: it.panStart.tx + dx, ty: it.panStart.ty + dy })
      return
    }

    if (it.selStart) {
      const p = toImage(e)
      const s = it.selStart
      setSelDraft({
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y)
      })
      return
    }

    const p = toImage(e)
    setDraft((d) => {
      if (!d) return d
      const points = d.tool === 'pen' ? [...d.points, p] : [d.points[0], p]
      return { ...d, points }
    })
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    const it = interaction.current
    interaction.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (!it || it.panStart) return

    if (it.selStart) {
      const rect = clampRectToImage(selDraft)
      setSelDraft(null)
      setTool('pan')
      // Ignore stray clicks / tiny boxes; otherwise upscale just that region.
      if (rect && rect.w >= 8 && rect.h >= 8) void doUpscale(rect)
      return
    }

    const d = draft
    setDraft(null)
    if (!d) return
    // Drop zero-extent shapes (a stray click) except freehand dots.
    if (d.tool !== 'pen' && !it.moved) return
    setAnnotations((prev) => [...prev, d])
  }

  /** Bakes the image + adjustments + drawings into a full-resolution canvas. */
  const buildCompositeCanvas = (): HTMLCanvasElement => {
    if (!img) throw new Error('No image')
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.filter = filterString(adjust)
    ctx.drawImage(img, 0, 0)
    ctx.filter = 'none'
    for (const a of annotations) drawShapeToCanvas(ctx, a)
    return canvas
  }

  /** Encodes a canvas to PNG bytes. */
  const canvasToPngBytes = async (canvas: HTMLCanvasElement): Promise<Uint8Array> => {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode PNG')
    return new Uint8Array(await blob.arrayBuffer())
  }

  const save = async (saveAs: boolean): Promise<void> => {
    if (!img || !payload || busy) return
    setBusy(true)
    setStatus(null)
    try {
      const bytes = await canvasToPngBytes(buildCompositeCanvas())
      const saved = await window.api.saveScreenshot(bytes, {
        saveAs,
        suggestedName: payload.suggestedName
      })
      if (saved) window.api.closeScreenshotEditor()
      else setStatus('Save cancelled')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  /** Clamps a selection rect to the image bounds (rounded to whole pixels). */
  const clampRectToImage = (r: Rect | null): Rect | null => {
    if (!r || !img) return null
    const x = Math.max(0, Math.min(img.naturalWidth, r.x))
    const y = Math.max(0, Math.min(img.naturalHeight, r.y))
    const w = Math.min(img.naturalWidth - x, r.w)
    const h = Math.min(img.naturalHeight - y, r.h)
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }
  }

  /** Replaces the working image from a data/object URL (drawings are reset). */
  const applyImageUrl = async (url: string): Promise<void> => {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not load image'))
      image.src = url
    })
    setAnnotations([])
    setDraft(null)
    setImg(image)
    setPayload((p) => (p ? { ...p, image: url } : p))
  }

  /** Replaces the working image with an upscaled canvas (drawings are reset). */
  const applyUpscaled = (canvas: HTMLCanvasElement): Promise<void> =>
    applyImageUrl(canvas.toDataURL('image/png'))

  /** Decodes PNG bytes (an AI result) to a data URL for {@link applyImageUrl}. */
  const bytesToDataUrl = (bytes: Uint8Array): Promise<string> =>
    new Promise((resolve, reject) => {
      const copy = new Uint8Array(bytes.byteLength)
      copy.set(bytes)
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Could not decode result'))
      reader.readAsDataURL(new Blob([copy.buffer], { type: 'image/png' }))
    })

  /**
   * Runs an AI image op against the configured provider with the user's key. The
   * current composited frame (adjustments + drawings baked in) is sent; the
   * returned image replaces it, so adjustments reset to neutral afterwards.
   */
  const runAi = async (op: ImageOp, prompt: string): Promise<void> => {
    if (!img || aiBusy || upBusy) return
    if (op === 'regenerate' && !prompt.trim()) {
      setStatus('Enter a prompt to regenerate.')
      return
    }
    setStatus(null)
    setAiStage(op === 'enhance' ? 'Enhancing…' : 'Regenerating…')
    try {
      const bytes = await canvasToPngBytes(buildCompositeCanvas())
      const result = await window.api.generateImage({ op, prompt, image: bytes })
      await applyImageUrl(await bytesToDataUrl(result.image))
      setAdjust(NEUTRAL)
      setStatus(
        `${op === 'enhance' ? 'Enhanced' : 'Regenerated'} with ${IMAGE_PROVIDERS[aiProvider].label}`
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'AI image failed')
    } finally {
      setAiStage(null)
    }
  }

  /** Runs super-resolution over the whole image, or just `crop` if given. */
  const doUpscale = async (crop?: Rect): Promise<void> => {
    if (!img || upBusy) return
    setStatus(null)
    setUpStage('Preparing…')
    setUpPct(null)
    setUpCanvas(null)
    setUpOut(null)
    setActiveTile(null)
    setUpBackend(null)
    const off = window.api.onUpscaleProgress((p) => {
      if (p.id !== modelId) return
      setUpStage('Downloading model…')
      setUpPct(p.total ? p.received / p.total : null)
    })
    try {
      // Load the session first (this is what may trigger a download), so the
      // progress phases read naturally: download → upscale.
      const backend = await loadUpscaleModel(modelId)
      setUpBackend(backend)
      setUpStage(backend === 'gpu' ? 'Upscaling on GPU…' : 'Upscaling on CPU…')
      setUpPct(0)
      const canvas = await runUpscale(img, {
        modelId,
        crop,
        onProgress: setUpPct,
        onStart: (out) => {
          setUpOut({ w: out.width, h: out.height })
          setUpCanvas(out)
        },
        onTile: setActiveTile
      })
      setActiveTile(null)
      await applyUpscaled(canvas)
      const scale = UPSCALE_MODELS[modelId].scale
      setStatus(
        `Upscaled ${crop ? 'selection ' : ''}${scale}× with ${UPSCALE_MODELS[modelId].label}` +
          ` (${backend === 'gpu' ? 'GPU' : 'CPU'})`
      )
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upscale failed')
    } finally {
      off()
      setUpStage(null)
      setUpPct(null)
      setUpCanvas(null)
      setUpOut(null)
      setActiveTile(null)
      setUpBackend(null)
    }
  }

  const zoomBy = (factor: number): void =>
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const vp = viewportRef.current
      if (!vp) return { ...v, scale }
      const k = scale / v.scale
      const cx = vp.clientWidth / 2
      const cy = vp.clientHeight / 2
      return { scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
    })

  const drawing = tool !== 'pan'
  const iw = img?.naturalWidth ?? 0
  const ih = img?.naturalHeight ?? 0

  return (
    <div className="flex h-screen flex-col bg-surface-900 text-zinc-100">
      {/* Title strip (native drag region). */}
      <div className="app-drag flex h-8 shrink-0 items-center justify-between border-b border-surface-700 pl-3">
        <span className="text-[11px] font-medium tracking-wide text-zinc-400">Edit screenshot</span>
        <WindowButtons fullscreen height={32} onClose={() => window.api.closeScreenshotEditor()} />
      </div>

      {/* Tool + zoom toolbar. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-700 bg-surface-800/95 px-3 py-1.5">
        <IconButton label="Pan / move (drag the image)" size="sm" active={tool === 'pan'} onClick={() => setTool('pan')}>
          <HandIcon />
        </IconButton>
        <span className="h-5 w-px bg-surface-600" />
        {DRAW_TOOLS.map(({ tool: t, label, Icon }) => (
          <IconButton key={t} label={label} size="sm" active={tool === t} onClick={() => setTool(t)}>
            <Icon size={16} />
          </IconButton>
        ))}

        <span className="h-5 w-px bg-surface-600" />
        <div className="flex items-center gap-1">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Colour ${c}`}
              title={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-5 w-5 rounded-full border transition-transform hover:scale-110 ${
                color === c ? 'border-white ring-2 ring-accent' : 'border-black/30'
              }`}
            />
          ))}
        </div>

        <span className="h-5 w-px bg-surface-600" />
        <div className="flex items-center gap-1">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={`Width ${w}`}
              title={`Width ${w}`}
              onClick={() => setStrokeWidth(w)}
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                strokeWidth === w ? 'bg-accent/20 ring-1 ring-accent/40' : 'hover:bg-surface-600'
              }`}
            >
              <span className="rounded-full bg-zinc-200" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
        </div>

        <span className="h-5 w-px bg-surface-600" />
        <IconButton
          label="Undo"
          size="sm"
          disabled={annotations.length === 0}
          onClick={() => setAnnotations((a) => a.slice(0, -1))}
        >
          <UndoIcon size={16} />
        </IconButton>
        <IconButton
          label="Clear all drawings"
          size="sm"
          disabled={annotations.length === 0}
          onClick={() => setAnnotations([])}
        >
          <TrashIcon size={16} />
        </IconButton>

        <span className="h-5 w-px bg-surface-600" />
        {/* Local super-resolution upscale */}
        <select
          value={modelId}
          disabled={upBusy || aiBusy}
          onChange={(e) => setModelId(e.target.value as UpscaleModelId)}
          title="Super-resolution model"
          className="h-7 rounded-md border border-surface-600 bg-surface-900 px-1.5 text-xs text-zinc-200 focus:border-accent/60 focus:outline-none disabled:opacity-40"
        >
          {UPSCALE_MODEL_IDS.map((id) => (
            <option key={id} value={id}>
              {UPSCALE_MODELS[id].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!img || upBusy || aiBusy}
          onClick={() => void doUpscale()}
          title="Upscale the whole image with AI super-resolution"
          className="flex h-7 items-center gap-1.5 rounded-md border border-surface-600 bg-surface-900 px-2 text-xs text-zinc-200 hover:border-accent/60 disabled:opacity-40"
        >
          <UpscaleIcon /> Upscale
        </button>
        <IconButton
          label="Upscale a selected area (drag a box over the region)"
          size="sm"
          active={tool === 'select'}
          disabled={!img || upBusy || aiBusy}
          onClick={() => setTool((t) => (t === 'select' ? 'pan' : 'select'))}
        >
          <SelectIcon />
        </IconButton>

        <span className="h-5 w-px bg-surface-600" />
        {/* AI image (bring-your-own-key): enhance / regenerate via the provider. */}
        <input
          type="text"
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          disabled={upBusy || aiBusy || !aiKeyReady}
          placeholder={aiKeyReady ? 'Describe changes…' : 'Add an API key in Settings'}
          title={
            aiKeyReady
              ? `Prompt for Regenerate (${IMAGE_PROVIDERS[aiProvider].label})`
              : 'Set a provider API key in Settings → AI image'
          }
          className="h-7 w-40 rounded-md border border-surface-600 bg-surface-900 px-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-accent/60 focus:outline-none disabled:opacity-40"
        />
        <button
          type="button"
          disabled={!img || upBusy || aiBusy || !aiKeyReady}
          onClick={() => void runAi('enhance', ENHANCE_PROMPT)}
          title={
            aiKeyReady
              ? 'AI enhance — clean up, sharpen and de-noise the current image'
              : 'Set a provider API key in Settings → AI image'
          }
          className="flex h-7 items-center gap-1.5 rounded-md border border-surface-600 bg-surface-900 px-2 text-xs text-zinc-200 hover:border-accent/60 disabled:opacity-40"
        >
          <SparkleIcon /> Enhance
        </button>
        <button
          type="button"
          disabled={!img || upBusy || aiBusy || !aiKeyReady || !aiPrompt.trim()}
          onClick={() => void runAi('regenerate', aiPrompt)}
          title={
            aiKeyReady
              ? 'AI regenerate the image from your prompt'
              : 'Set a provider API key in Settings → AI image'
          }
          className="flex h-7 items-center gap-1.5 rounded-md border border-surface-600 bg-surface-900 px-2 text-xs text-zinc-200 hover:border-accent/60 disabled:opacity-40"
        >
          <RegenerateIcon /> Regenerate
        </button>

        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Zoom out" size="sm" onClick={() => zoomBy(1 / 1.2)}>
            <ZoomOutIcon size={16} />
          </IconButton>
          <span className="w-12 text-center font-mono text-xs tabular-nums text-zinc-300">
            {Math.round(view.scale * 100)}%
          </span>
          <IconButton label="Zoom in" size="sm" onClick={() => zoomBy(1.2)}>
            <ZoomInIcon size={16} />
          </IconButton>
          <button
            type="button"
            onClick={fit}
            className="rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-surface-600"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Canvas + adjustments. */}
      <div className="flex min-h-0 flex-1">
        <div
          ref={viewportRef}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className={`relative flex-1 overflow-hidden bg-[#0b0b0e] ${
            drawing ? 'cursor-crosshair' : 'cursor-grab'
          }`}
        >
          {img ? (
            <div
              className="absolute left-0 top-0"
              style={{
                width: iw,
                height: ih,
                transformOrigin: '0 0',
                transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`
              }}
            >
              <img
                src={payload?.image}
                alt="Screenshot"
                draggable={false}
                className="block select-none"
                style={{ width: iw, height: ih, filter: filterString(adjust) }}
              />
              <svg
                width={iw}
                height={ih}
                className="pointer-events-none absolute left-0 top-0"
              >
                {annotations.map((a, i) => (
                  <Shape key={i} shape={a} toPx={(n) => n} />
                ))}
                {draft && <Shape shape={draft} toPx={(n) => n} />}
                {selDraft && (
                  <rect
                    x={selDraft.x}
                    y={selDraft.y}
                    width={selDraft.w}
                    height={selDraft.h}
                    fill="rgba(99,102,241,0.15)"
                    stroke="#818cf8"
                    strokeWidth={1.5 / view.scale}
                    strokeDasharray={`${6 / view.scale} ${4 / view.scale}`}
                  />
                )}
              </svg>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Capturing frame…
            </div>
          )}

          {tool === 'select' && !upBusy && (
            <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
              <span className="rounded-full bg-surface-900/90 px-3 py-1 text-xs text-zinc-200 shadow ring-1 ring-surface-600">
                Drag a box over the region to upscale
              </span>
            </div>
          )}

          {upBusy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-surface-900/80 p-6 backdrop-blur-sm">
              {upCanvas && upOut && (
                <div
                  className="relative max-h-[78%] max-w-[88%] overflow-hidden rounded ring-1 ring-surface-600"
                  style={{ aspectRatio: `${upOut.w} / ${upOut.h}` }}
                >
                  {/* The output canvas, drawn into tile-by-tile by runUpscale. */}
                  <div ref={upHostRef} className="absolute inset-0 bg-[#0b0b0e]" />
                  {/* Highlight the tile currently being processed (user-units = output px). */}
                  {activeTile && (
                    <svg
                      className="absolute inset-0 h-full w-full"
                      viewBox={`0 0 ${upOut.w} ${upOut.h}`}
                      preserveAspectRatio="none"
                    >
                      <rect
                        x={activeTile.x}
                        y={activeTile.y}
                        width={activeTile.w}
                        height={activeTile.h}
                        fill="rgba(129,140,248,0.18)"
                        stroke="#818cf8"
                        strokeWidth={Math.max(upOut.w, upOut.h) / 260}
                      />
                    </svg>
                  )}
                </div>
              )}
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm text-zinc-100">{upStage}</span>
                <div className="h-1.5 w-56 overflow-hidden rounded-full bg-surface-700">
                  <div
                    className="h-full rounded-full bg-accent transition-[width]"
                    style={{ width: `${Math.round((upPct ?? 0) * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-zinc-400">
                  {upPct === null ? '' : `${Math.round(upPct * 100)}%`}
                  {upBackend ? `  ·  ${upBackend === 'gpu' ? 'GPU' : 'CPU'}` : ''}
                </span>
              </div>
            </div>
          )}

          {aiBusy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-900/80 backdrop-blur-sm">
              <svg className="h-8 w-8 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="text-sm text-zinc-100">{aiStage}</span>
              <span className="text-[11px] text-zinc-400">via {IMAGE_PROVIDERS[aiProvider].label}</span>
            </div>
          )}
        </div>

        <aside className="w-60 shrink-0 space-y-4 overflow-y-auto border-l border-surface-700 bg-surface-800/95 p-4 scrollbar-thin">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Adjustments
            </span>
            <button
              type="button"
              onClick={() => setAdjust(NEUTRAL)}
              title="Reset adjustments"
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-zinc-400 hover:bg-surface-600 hover:text-zinc-200"
            >
              <ResetIcon size={14} /> Reset
            </button>
          </div>

          <AdjustRow
            label="Saturation"
            min={0}
            max={300}
            value={adjust.saturation}
            onChange={(saturation) => setAdjust((a) => ({ ...a, saturation }))}
          />
          <AdjustRow
            label="Brightness"
            min={0}
            max={200}
            value={adjust.brightness}
            onChange={(brightness) => setAdjust((a) => ({ ...a, brightness }))}
          />
          <AdjustRow
            label="Contrast"
            min={0}
            max={200}
            value={adjust.contrast}
            onChange={(contrast) => setAdjust((a) => ({ ...a, contrast }))}
          />
          <AdjustRow
            label="Hue"
            min={0}
            max={360}
            unit="°"
            value={adjust.hue}
            onChange={(hue) => setAdjust((a) => ({ ...a, hue }))}
          />

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={adjust.grayscale}
              onChange={(e) => setAdjust((a) => ({ ...a, grayscale: e.target.checked }))}
              className="accent-accent"
            />
            Grayscale
          </label>
        </aside>
      </div>

      {/* Actions. */}
      <div className="flex items-center gap-3 border-t border-surface-700 bg-surface-800/95 px-4 py-2.5">
        <span className="text-xs text-zinc-400">{status}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.api.closeScreenshotEditor()}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:bg-surface-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || upBusy || aiBusy || !img}
            onClick={() => void save(true)}
            className="rounded-lg px-3 py-1.5 text-sm text-zinc-100 ring-1 ring-surface-500 hover:bg-surface-600 disabled:opacity-40"
          >
            Save As…
          </button>
          <button
            type="button"
            disabled={busy || upBusy || aiBusy || !img}
            onClick={() => void save(false)}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

/** A labelled adjustment slider with an inline numeric readout. */
function AdjustRow({
  label,
  value,
  min,
  max,
  unit = '%',
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  unit?: string
  onChange: (value: number) => void
}): JSX.Element {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono tabular-nums text-zinc-300">
          {value}
          {unit}
        </span>
      </div>
      <Slider label={label} min={min} max={max} value={value} onChange={onChange} className="w-full" />
    </div>
  )
}

/** Sparkle-in-frame glyph for the upscale action (kept local). */
function UpscaleIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4" />
      <path d="M12 8.5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5L8.5 12l2.5-1z" />
    </svg>
  )
}

/** Sparkles glyph for the AI Enhance action (kept local). */
function SparkleIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
    </svg>
  )
}

/** Circular-arrows glyph for the AI Regenerate action (kept local). */
function RegenerateIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v5h-5" />
    </svg>
  )
}

/** Dashed marquee glyph for the area-select tool (kept local). */
function SelectIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 2.5">
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
    </svg>
  )
}

/** A hand/grab glyph for the pan tool (kept local; not in the shared set). */
function HandIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 12V4.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 12V6a1.5 1.5 0 0 1 3 0v6" />
      <path d="M17 8a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7l-2.3-3.4a1.5 1.5 0 0 1 2.5-1.6L8 14" />
    </svg>
  )
}
