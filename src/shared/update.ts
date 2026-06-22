/**
 * Auto-update status, pushed from the main process (where electron-updater runs)
 * to every renderer so the UI can reflect the current phase of a self-update.
 *
 * It is a flat state machine: at most one update is ever in flight, and each
 * value carries exactly the data that phase needs (the target version, download
 * progress, or an error message). `idle` is the initial value before any check;
 * `up-to-date` is the result of a check that found nothing newer.
 */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'up-to-date' }
  | { state: 'error'; message: string }
