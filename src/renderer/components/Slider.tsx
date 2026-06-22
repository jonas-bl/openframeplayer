interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label: string
  className?: string
}

/**
 * Thin wrapper around a native range input, styled to the app accent. Reused
 * for volume and the image-correction controls (brightness, contrast, zoom).
 * Native input keeps keyboard + accessibility behaviour for free.
 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  className = ''
}: SliderProps): JSX.Element {
  return (
    <input
      type="range"
      aria-label={label}
      title={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`h-1 cursor-pointer appearance-none rounded-full bg-surface-500 accent-accent ${className}`}
    />
  )
}
