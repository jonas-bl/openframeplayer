# FramePlayer

A modern, frame-accurate desktop video player. Electron shell + React/Tailwind
UI, with **mpv** as the video engine driven over JSON IPC. Built for precise
frame review: single-frame stepping, zoom/pan, brightness/contrast, horizontal
flip, and lossless PNG screenshots of the exact decoded pixels.

> Windows is the primary target. The architecture keeps platform-specific bits
> (IPC socket path, window embedding) behind small abstractions so a later
> macOS port is a contained change.

## Prerequisites

- Node.js 20+
- mpv (bundled into `resources/mpv`, see below)

## Getting started

```bash
npm install
npm run fetch:mpv     # downloads an official Windows mpv build into resources/mpv
npm run dev           # launch in development (HMR for the renderer)
```

`fetch:mpv` pulls a prebuilt mpv from the official `zhongfly/mpv-winbuild`
releases and extracts it with the bundled `7za`. At runtime mpv is located via,
in order: `MPV_PATH`, the bundled `resources/mpv`, the system `PATH`, then
common install locations. If mpv can't be found, the UI shows a clear error
instead of failing silently.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Run the app with the dev server |
| `npm run build` | Type-check-free production build to `out/` |
| `npm run typecheck` | Type-check main + renderer |
| `npm test` | Unit tests (pure logic; no mpv/Electron) |
| `npm run test:integration` | End-to-end tests against the bundled mpv |
| `npm run package` | Build + electron-builder package |

## Keyboard shortcuts

All shortcuts are **rebindable** in Settings (gear icon in the title bar, or `,`).

| Key | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Previous / next frame |
| `+` / `-` | Zoom in / out |
| `D` / double-click | Reset zoom & pan |
| Mouse drag | Pan · Mouse wheel | Zoom toward cursor |
| `S` | Lossless screenshot (PNG) |
| `F` | Flip horizontal |
| `R` | Reset image corrections |
| `I` | Show / hide image panel |
| `F11` | Toggle fullscreen (`Esc` exits) |
| `P` | Pop out controls into a floating window |
| `O` | Open file |
| `,` | Settings |

## Open with FramePlayer

The app enforces a single instance and loads any file passed on the command
line, so "Open with FramePlayer" reuses the running window. The Windows
context-menu / file-association entry is registered by the NSIS installer
(`fileAssociations` in `electron-builder.yml`) — run `npm run package`, install
the result, and the video types gain an "Open with FramePlayer" entry. (File
associations cannot be registered from a `npm run dev` session.)

## Architecture

Strict layering — the renderer never speaks mpv; it only dispatches semantic
actions and reads `PlayerState`:

```
React UI (renderer)
  │  semantic PlayerAction / PlayerState     ← src/shared (the contract)
  ▼
preload contextBridge  (window.api, window.windowControls)
  ▼
main IPC bridge  →  PlayerService  →  command map (action → mpv ops, pure)
                                   →  MpvController → MpvIpcClient → mpv (named pipe)
```

Key modules:

- **`src/shared`** — the cross-process contract: `PlayerAction`, `PlayerState`,
  IPC channel names/types. The single source of truth both sides import.
- **`src/main/mpv/commandMap.ts`** — the one place UI actions become mpv
  property sets / commands. Pure and exhaustively tested.
- **`src/main/mpv`** — the engine: process spawn, JSON-IPC framing, the
  controller, and binary/socket-path resolution.
- **`src/main/state`** — the authoritative `PlayerStateStore` and the pure
  mpv-property → state bindings.
- **`src/main/embedding`** — Windows window embedding. mpv renders into the
  video window via `--wid`; because Chromium's compositor sits above child
  windows, the mpv child is raised above it with a small `user32`/koffi call.
- **`src/main/window`** — the two-window pair: an opaque **video** window (mpv
  host) and a transparent, frameless **overlay** window (the React UI) glued on
  top. This is what makes a controls-over-video UI possible on Windows.
- **`src/renderer`** — React components, the Zustand mirror of `PlayerState`,
  gesture/keyboard hooks.

### Why two windows?

A native child window (mpv) does not composite through a transparent web view,
and an opaque web page covers the embedded video. The robust solution is two
top-level windows: video underneath, a transparent UI overlay on top, kept in
lockstep by `PlayerWindows`. The frameless window's move/resize/min/max/close
are driven from the overlay via IPC (`registerWindowControls`).

## Testing

Pure logic is covered by fast unit tests (command map, state bindings, protocol
framing, path resolution, resize math, formatting, shortcut mapping). The
`*.integration.test.ts` suites spawn the real bundled mpv and verify every
mandatory feature end to end — including writing and validating a real PNG
screenshot — and auto-skip when mpv is absent.
