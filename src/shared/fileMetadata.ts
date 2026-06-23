/**
 * Per-file persisted state: where you left off, when you last opened it, and
 * (from Phase 2) timeline markers. Keyed by absolute file path in the
 * main-process `FileMetadataStore`. This is deliberately separate from
 * {@link AppSettings} — it is per-file, churns often (resume position), and
 * grows unbounded, so it lives in its own file.
 */

/** A user-placed timeline marker (bookmarks; the UI lands in Phase 2). */
export interface Marker {
  /** Position in seconds. */
  time: number
  /** Optional short note. */
  label?: string
}

export interface FileMetadata {
  /** Last playback position in seconds; 0 when none / finished. */
  resumePos: number
  /** Duration observed when the position was saved (for "near the end" checks). */
  durationSeen: number
  /** Epoch ms of the last time the file was opened (drives the recents list). */
  lastOpened: number
  /** Timeline markers for this file. */
  bookmarks: Marker[]
}

/** One entry in the recent-files list. */
export interface RecentFile {
  path: string
  lastOpened: number
}

export const EMPTY_FILE_METADATA: FileMetadata = {
  resumePos: 0,
  durationSeen: 0,
  lastOpened: 0,
  bookmarks: []
}

/** Normalises a possibly-partial/stale persisted record onto the defaults. */
export function mergeFileMetadata(partial: Partial<FileMetadata> | null | undefined): FileMetadata {
  return {
    resumePos: numberOr(partial?.resumePos, 0),
    durationSeen: numberOr(partial?.durationSeen, 0),
    lastOpened: numberOr(partial?.lastOpened, 0),
    bookmarks: Array.isArray(partial?.bookmarks)
      ? partial!.bookmarks.filter((b): b is Marker => typeof b?.time === 'number')
      : []
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
