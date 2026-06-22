# Briefing: Custom Video Player

> Übergabe-Dokument für die Umsetzung in der IDE (z. B. Claude Code in VS Code).
> Enthält die komplette Entscheidungsgrundlage – die ausführende Instanz kennt den vorherigen Chat nicht.

## Ziel

Ein moderner Desktop-Video-Player mit **schönem, nicht-altbackenem GUI** und **frame-genauen Bearbeitungs-Features**. Bestehende Player sind unzureichend, deshalb Eigenbau. Fokus liegt auf präziser Bildkontrolle (Einzelbild, Zoom, Bildkorrektur) und verlustfreien Screenshots.

## Tech-Stack (festgelegt – nicht neu evaluieren)

- **Electron** als Desktop-Shell
- **React + Tailwind CSS** fürs UI (modern, dark mode, custom controls)
- **mpv / libmpv** als Video-Engine, gesteuert über **JSON-IPC**
- mpv-Binary wird mitgeliefert bzw. zur Laufzeit lokalisiert

**Warum dieser Stack:** mpv liefert frame-genaues Seeking und nahezu alle geforderten Features als native Properties; Electron + React gibt volle Freiheit für ein schönes UI. Web-`<video>` scheidet aus, weil frame-by-frame *rückwärts* damit nicht zuverlässig funktioniert (Codec-Keyframe-Problematik).

## Zielplattform & Performance

- **Windows: Primärziel** – muss zuverlässig laufen. Windows-spezifische Details (Embedding, IPC) haben Priorität.
- **macOS: optional / später** – Architektur so sauber halten, dass ein späterer Port möglich ist, aber nicht jetzt umsetzen.
- **4K / volle Qualität:** Player muss 4K-Material flüssig abspielen, immer in der bestmöglichen Qualität der Quelldatei.
- **GPU-Dekodierung aktivieren** (`hwdec=auto-safe` o. ä.), damit 4K performant läuft. High-Quality-Scaling für die Wiedergabe nutzen.

## Pflicht-Features (alle frame-genau, wo relevant)

1. **Zoom** inkl. **Maus-Drag-Zoom** → mpv `video-zoom`, `video-pan-x`, `video-pan-y`
2. **Frame-by-frame vor/zurück** → mpv `frame-step` / `frame-back-step`
3. **Screenshot, verlustfrei (PNG)** → mpv `screenshot` command im **video-Modus** (exakte dekodierte Pixel, ohne UI-Overlay)
4. **Helligkeit / Kontrast** → mpv `brightness`, `contrast`
5. **Flip horizontal** → mpv Videofilter `hflip` (toggle)

## Architektur-Vorgaben

- mpv läuft als **eigener Prozess**; Kommunikation über **IPC-Socket**
  - Windows: **Named Pipe** (`\\.\pipe\...`)
  - Unix (für späteren mac-Port): Unix-Domain-Socket
- Saubere Schichtentrennung: **React-UI ↔ Electron-Main (IPC-Bridge) ↔ mpv**
- Ein **zentrales Command-Mapping-Modul**: UI-Aktion → mpv-Property/Command. Keine mpv-Logik im UI verstreuen.
- mpv-Video **sauber ins Fenster einbetten** (Embedding über Window-Handle / `--wid`), **nicht** als loses Overlay.
- State (Zoom-Level, Helligkeit, Kontrast, Flip-Status etc.) zentral im UI halten und mit mpv synchron halten.

## Reihenfolge (Build-Plan)

1. **Projektgerüst:** Electron + React + Tailwind, lauffähiges leeres Fenster.
2. **mpv-Anbindung:** mpv-Prozess starten + IPC-Verbindung herstellen, Testvideo laden, einfache Property lesen/schreiben verifizieren.
3. **Embedding (kritischster Teil – früh absichern):** mpv-Videobild ins Electron-Fenster einbetten (Windows-Window-Handle). Erst weitermachen, wenn das stabil sitzt.
4. **Basis-Transport:** Play/Pause, Seek, Zeit-/Frame-Anzeige, Lautstärke.
5. **Pflicht-Features 1–5** einzeln anbinden und je einzeln testen.
6. **UI-Politur:** modernes Design, Keyboard-Shortcuts, Drag-Zoom-Feinschliff, Settings.

## Bekannte Stolpersteine (vorab beachten)

- **mpv-Embedding ist plattformabhängig** → auf Windows zuerst absichern (Schritt 3), nicht ans Ende schieben.
- **mpv-Binary muss gefunden / gebündelt werden** → sauberes Pfad-Handling, auch im gepackten Build (nicht nur im Dev-Modus).
- **IPC-Socket-Pfad** unterscheidet sich Windows vs. Unix → von Anfang an abstrahieren, auch wenn zunächst nur Windows zählt.
- **4K-Performance** → ohne HW-Dekodierung ruckelt es; früh mit echtem 4K-Material testen, nicht nur mit kleinen Clips.
- **Screenshot-Modus** → `video`-Modus verwenden (reine Videopixel), nicht `window` (würde UI/Skalierung einrechnen).

## Empfohlene Keyboard-Shortcuts (Vorschlag, anpassbar)

- `←` / `→` : Frame zurück / vor
- `Space` : Play / Pause
- `+` / `-` : Zoom rein / raus
- Maus-Drag : Pan / Drag-Zoom
- `S` : Screenshot
- `F` : Flip horizontal
- `R` : Bildkorrekturen (Helligkeit/Kontrast/Zoom/Flip) zurücksetzen