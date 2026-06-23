import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  EMPTY_FILE_METADATA,
  mergeFileMetadata,
  type FileMetadata,
  type Marker,
  type RecentFile
} from '@shared/fileMetadata'

/** How long to coalesce writes; resume saves arrive every few seconds. */
const SAVE_DEBOUNCE_MS = 1500
/** Cap on retained per-file records (oldest by `lastOpened` are pruned). */
const MAX_ENTRIES = 200

/**
 * Persists per-file metadata (resume position, last-opened time, bookmarks) as
 * a single JSON map keyed by absolute path. Mirrors {@link SettingsStore}: reads
 * are tolerant (missing/corrupt → empty), writes are best-effort and never throw
 * into the caller. Writes are debounced because resume positions stream in
 * frequently; {@link flush} forces a synchronous write on shutdown.
 */
export class FileMetadataStore {
  private data: Record<string, FileMetadata>
  private saveTimer: NodeJS.Timeout | null = null

  constructor(private readonly filePath: string) {
    this.data = this.load()
  }

  /** The stored record for `path`, or null when unknown. */
  get(path: string): FileMetadata | null {
    return this.data[path] ?? null
  }

  /**
   * Records the resume position (and bumps `lastOpened`) for a file. A position
   * within the final few seconds is stored as 0 so the next open starts fresh.
   */
  saveResume(path: string, pos: number, duration: number): void {
    const finished = duration > 0 && pos >= duration - 5
    const prev = this.data[path] ?? EMPTY_FILE_METADATA
    this.data[path] = {
      ...prev,
      resumePos: finished ? 0 : Math.max(0, pos),
      durationSeen: duration > 0 ? duration : prev.durationSeen,
      lastOpened: Date.now()
    }
    this.scheduleSave()
  }

  /** Replaces the bookmark list for a file (used by the Phase 2 markers UI). */
  setBookmarks(path: string, bookmarks: Marker[]): void {
    const prev = this.data[path] ?? EMPTY_FILE_METADATA
    this.data[path] = { ...prev, bookmarks }
    this.scheduleSave()
  }

  /** The most-recently-opened files, newest first. */
  recents(limit = 12): RecentFile[] {
    return Object.entries(this.data)
      .filter(([, m]) => m.lastOpened > 0)
      .sort((a, b) => b[1].lastOpened - a[1].lastOpened)
      .slice(0, limit)
      .map(([path, m]) => ({ path, lastOpened: m.lastOpened }))
  }

  /** Forces any pending write to disk immediately (call on shutdown). */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    this.save()
  }

  private scheduleSave(): void {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      this.prune()
      this.save()
    }, SAVE_DEBOUNCE_MS)
  }

  /** Keeps the file from growing without bound by dropping the oldest entries. */
  private prune(): void {
    const entries = Object.entries(this.data)
    if (entries.length <= MAX_ENTRIES) return
    const keep = entries
      .sort((a, b) => b[1].lastOpened - a[1].lastOpened)
      .slice(0, MAX_ENTRIES)
    this.data = Object.fromEntries(keep)
  }

  private load(): Record<string, FileMetadata> {
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Record<string, unknown>
      const out: Record<string, FileMetadata> = {}
      for (const [path, value] of Object.entries(raw)) {
        out[path] = mergeFileMetadata(value as Partial<FileMetadata>)
      }
      return out
    } catch {
      return {}
    }
  }

  private save(): void {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true })
      writeFileSync(this.filePath, JSON.stringify(this.data), 'utf8')
    } catch {
      /* best-effort; metadata simply won't persist this session */
    }
  }
}
