# Onboarding tour images

Drop screenshots here and they appear automatically in the first-run feature
tour (`src/renderer/components/Onboarding.tsx`). Each step looks for a file by
name; if it's missing, a branded gradient placeholder is shown instead, so the
tour always works.

- **Format:** PNG (or JPG / WEBP). **Aspect:** 16:9 (e.g. 1280×720 or 1600×900).
- **Naming:** use exactly the filenames below (the extension can be png/jpg/webp).

| File            | What it should show |
| --------------- | ------------------- |
| `01-welcome`    | A real video frame open in FramePlayer, zoomed in a touch, with the transport bar visible showing a timecode + frame number. The "hero" shot of the app in use. |
| `02-modes`      | The mode switch in Settings (Casual / Standard / Pro / Custom), or a side-by-side of the *same* frame in Casual vs Pro so the difference in on-screen UI is obvious. |
| `03-analysis`   | Pro mode with the right-hand analysis dock open — scopes (waveform / histogram) beside the frame, ideally with the frame-diff or measurement overlay visible. |
| `04-annotate`   | A frame with a freehand drawing / arrow annotation on it, and a subject boxed or kept centred by autofocus tracking. |
| `05-export`     | The screenshot editor open with an image (bonus: the AI upscale/enhance controls), or the export menu showing Clip / GIF / PNG-sequence options. |
| `06-compare`    | Two FramePlayer windows side by side showing two versions of the same shot, with their transport linked. |
