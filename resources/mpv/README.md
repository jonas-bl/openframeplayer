# Bundled mpv runtime

This folder holds the mpv binary that the app ships with. The binary itself is
**not committed** (see the repo `.gitignore`) — it is fetched per machine and
bundled into packaged builds via electron-builder `extraResources`.

## Windows

Place `mpv.exe` (and its `.dll` dependencies, if using a shared build) here:

```
resources/mpv/mpv.exe
```

Recommended source: the official Windows builds (shinchiro / mpv.io). A
`libmpv`-capable build is fine; we drive it as a child process over JSON IPC.

## Resolution order at runtime

The loader (`src/main/mpv/locateMpv.ts`) searches, in order:

1. `MPV_PATH` environment variable (explicit override)
2. This bundled location (`resources/mpv/mpv.exe`, dev and packaged)
3. The system `PATH`
4. Common install locations (e.g. Chocolatey, Scoop, Program Files)

If none resolve, the UI surfaces a clear "mpv not found" engine error rather
than failing silently.
