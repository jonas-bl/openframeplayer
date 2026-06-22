import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible label; also used as the tooltip. */
  label: string
  children: ReactNode
  active?: boolean
  size?: 'sm' | 'md'
}

/**
 * Square icon button used throughout the control surface. Consistent sizing,
 * focus ring, hover and active (toggled-on) styling in one place.
 */
export function IconButton({
  label,
  children,
  active = false,
  size = 'md',
  className = '',
  ...rest
}: IconButtonProps): JSX.Element {
  const box = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
  const tone = active
    ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
    : 'text-zinc-300 hover:bg-surface-600 hover:text-white'

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`flex ${box} items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40 ${tone} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
