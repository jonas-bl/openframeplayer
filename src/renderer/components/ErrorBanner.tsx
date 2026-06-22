/** Prominent, non-blocking banner for engine errors (e.g. mpv not found). */
export function ErrorBanner({ message }: { message: string }): JSX.Element {
  return (
    <div className="flex items-center gap-2 bg-red-950/90 px-4 py-2 text-sm text-red-200 backdrop-blur">
      <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
      <span className="truncate">{message}</span>
    </div>
  )
}
