# FramePlayer

**A frame-accurate desktop video player for people who need to look closely.**

FramePlayer is built for the moments where regular players fall short — stepping through footage one frame at a time, scrubbing to an exact moment, zooming in on detail, and marking up what you see. It's powered by [mpv](https://mpv.io/) under the hood, so playback is fast and accurate, wrapped in a clean, modern interface.

> Windows-first. Free and open source (MIT).

---

## Why FramePlayer?

Most video players are built for *watching*. FramePlayer is built for *studying* footage:

- 🎯 **True frame accuracy** — step forward or back exactly one frame at a time, with a live frame and timecode readout.
- 🔍 **Zoom & pan** — magnify any part of the picture, scroll to zoom right where your cursor is, and drag to pan around.
- 🔁 **Smart looping** — loop the whole file, loop a custom A–B section, or play in reverse.
- ⏱️ **Instant scrubbing** — the timeline responds the moment you drag and lands on the exact frame when you let go.
- ✏️ **Draw on the video** — annotate frames with an overlay, and click to re-center on a point of interest.
- 📸 **Lossless screenshots** — grab a pixel-perfect PNG of the current frame, then enhance or upscale it with built-in AI tools.
- 🪟 **Multi-window** — open as many independent players as you like, each with its own video and controls.
- ⚙️ **Your shortcuts** — remap the keyboard controls to whatever feels natural; they're saved between sessions.

---

## Features

### Playback & navigation
- Play / pause, frame-step forward and backward
- Exact (precise) seeking, plus fast scrubbing while you drag the timeline
- Adjustable playback speed
- Live time and frame-number display

### Looping
- Whole-file loop
- A–B loop over a section you choose
- Reverse playback

### Picture controls
- Zoom in/out, drag to pan, and scroll-to-zoom centered on your cursor
- Brightness and contrast adjustment
- Horizontal flip
- Double-click the video to reset zoom and pan
- One-click reset of all adjustments

### Screenshots & AI tools
- Lossless PNG capture of the current frame
- AI super-resolution upscaling (whole image or a selected area)
- AI image enhancement and regeneration in the built-in screenshot editor *(bring your own OpenAI / Stability API key)*

### Annotation
- Freehand drawing overlay on top of the video
- Click-to-center / focus tool
- Drawing tools stay in sync between the main window and the pop-out controls

### Interface
- Frameless, modern custom title bar
- Fullscreen mode with auto-hiding controls
- Pop-out controls window, so the controls can live separately from the video
- Show/hide the image-adjustment panel
- Multiple independent player windows in one app

### Convenience
- **"Open with FramePlayer"** — set it as the handler for your video files and double-click to open *(available once installed)*
- Configurable keyboard shortcuts, saved automatically
- Self-updating — new versions install themselves from GitHub Releases

---

## Getting started

### Install (recommended)
Download the latest **`FramePlayer-Setup.exe`** from the [Releases page](../../releases), run the installer, and you're done. FramePlayer keeps itself up to date automatically.

> ℹ️ The installer is currently unsigned, so Windows SmartScreen may show a warning the first time you run it. Click **More info → Run anyway** to continue.

### Open a video
- Launch FramePlayer and open a file from the title bar, **or**
- Right-click a video → **Open with → FramePlayer**, **or**
- Set FramePlayer as your default video player.

---

## Keyboard shortcuts

FramePlayer ships with sensible defaults and lets you remap everything from **Settings**. A few highlights:

| Action | Default |
| --- | --- |
| Play / pause | `Space` |
| Frame step back / forward | `←` / `→` |
| Zoom in / out | `+` / `-` |
| Zoom toward cursor | Mouse wheel |
| Playback speed | `Alt` + mouse wheel |
| Lossless screenshot | `S` |
| Fullscreen | `F11` (exit with `Esc`) |
| Pop out controls | `P` |
| Toggle image panel | `I` |
| New window | `N` |
| Settings | `,` |

Open **Settings** in the app to see and change the full list — your bindings are saved between sessions.

---

## About the tech

FramePlayer is an [Electron](https://www.electronjs.org/) app with a [React](https://react.dev/) + [Tailwind](https://tailwindcss.com/) interface, using **mpv** as the playback engine. mpv is bundled with the installer, so there's nothing extra to set up.

<details>
<summary>Building from source</summary>

```bash
# install dependencies
npm install

# download the bundled mpv engine
npm run fetch:mpv

# run in development
npm run dev

# build an installer
npm run package
```

</details>

---

## Contributing

Issues and pull requests are welcome. If you hit a bug or have an idea, please [open an issue](../../issues).

## License

[MIT](LICENSE) © Jonas Bleisteiner
