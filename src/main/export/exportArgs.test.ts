import { describe, expect, it } from 'vitest'
import { buildExportArgs, buildExportName } from './exportArgs'

describe('buildExportArgs', () => {
  const common = { inputPath: 'in.mkv', output: 'out', startSeconds: 1.5, endSeconds: 4 }

  it('trims the range with --start/--end for every format', () => {
    for (const format of ['mp4', 'gif', 'pngseq'] as const) {
      const args = buildExportArgs({ ...common, format })
      expect(args).toContain('--start=1.5')
      expect(args).toContain('--end=4')
      expect(args[0]).toBe('in.mkv')
    }
  })

  it('encodes an H.264 + AAC mp4 in encode mode', () => {
    const args = buildExportArgs({ ...common, output: 'clip.mp4', format: 'mp4' })
    expect(args).toContain('--ovc=libx264')
    expect(args).toContain('--oac=aac')
    expect(args).toContain('--o=clip.mp4')
  })

  it('builds an audioless, downscaled gif with the given fps/width', () => {
    const args = buildExportArgs({
      ...common,
      output: 'clip.gif',
      format: 'gif',
      gifFps: 12,
      gifWidth: 320
    })
    expect(args).toContain('--no-audio')
    expect(args).toContain('--vf=fps=12,scale=320:-1:flags=lanczos')
    expect(args).toContain('--ovc=gif')
    expect(args).toContain('--o=clip.gif')
  })

  it('dumps a PNG sequence untimed to the output directory (no encode --o)', () => {
    const args = buildExportArgs({ ...common, output: 'C:/frames', format: 'pngseq' })
    expect(args).toContain('--untimed')
    expect(args).toContain('--vo=image')
    expect(args).toContain('--vo-image-format=png')
    expect(args).toContain('--vo-image-outdir=C:/frames')
    expect(args.some((a) => a.startsWith('--o='))).toBe(false)
  })
})

describe('buildExportName', () => {
  const date = new Date(2026, 5, 23, 16, 5, 1) // 2026-06-23 16:05:01

  it('embeds the source stem, frame range and timestamp with the right extension', () => {
    expect(buildExportName('/path/My Clip.mkv', 'mp4', 30, 90, date)).toBe(
      'My_Clip_f30-90_20260623-160501.mp4'
    )
    expect(buildExportName('/path/My Clip.mkv', 'gif', 30, 90, date)).toBe(
      'My_Clip_f30-90_20260623-160501.gif'
    )
  })

  it('omits the extension for a PNG sequence (used as a folder name)', () => {
    expect(buildExportName('/path/clip.mkv', 'pngseq', 0, 10, date)).toBe(
      'clip_f0-10_20260623-160501'
    )
  })

  it('falls back to "clip" when there is no source path', () => {
    expect(buildExportName(null, 'mp4', 0, 0, date)).toBe('clip_f0-0_20260623-160501.mp4')
  })
})
