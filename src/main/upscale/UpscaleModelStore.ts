import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import {
  UPSCALE_MODELS,
  UPSCALE_MODEL_IDS,
  type UpscaleModelId,
  type UpscaleModelStatus
} from '@shared/upscale'

/** Reports bytes received so far (and total, or 0 if unknown) during a download. */
export type ProgressFn = (received: number, total: number) => void

/**
 * Downloads, caches, and serves the super-resolution model weights on demand.
 *
 * Models are large (tens of MB) and most users never upscale, so nothing ships
 * with the app — each model is fetched the first time it's needed and cached
 * under `userData/models/upscale`. This mirrors how mpv is fetched rather than
 * committed. Downloads stream to a `.part` file and atomically rename on
 * completion, so an interrupted download can't leave a corrupt model behind.
 */
export class UpscaleModelStore {
  /** In-flight downloads, de-duped by id so concurrent requests share one fetch. */
  private readonly inflight = new Map<UpscaleModelId, Promise<void>>()

  constructor(private readonly dir: string) {}

  private pathFor(id: UpscaleModelId): string {
    return join(this.dir, UPSCALE_MODELS[id].file)
  }

  /** Whether each model already exists on disk. */
  async status(): Promise<UpscaleModelStatus> {
    const result = {} as UpscaleModelStatus
    for (const id of UPSCALE_MODEL_IDS) result[id] = existsSync(this.pathFor(id))
    return result
  }

  /**
   * Ensures the model is on disk (downloading + caching it first if necessary)
   * and returns its file path — handed to onnxruntime-node to build a session.
   */
  async ensure(id: UpscaleModelId, onProgress?: ProgressFn): Promise<string> {
    const path = this.pathFor(id)
    if (existsSync(path)) return path

    let promise = this.inflight.get(id)
    if (!promise) {
      promise = this.download(id, onProgress).finally(() => this.inflight.delete(id))
      this.inflight.set(id, promise)
    }
    await promise
    return path
  }

  /** Deletes a cached model. Resolves to whether a file was actually removed. */
  async remove(id: UpscaleModelId): Promise<boolean> {
    const path = this.pathFor(id)
    if (!existsSync(path)) return false
    await rm(path, { force: true })
    return true
  }

  private async download(id: UpscaleModelId, onProgress?: ProgressFn): Promise<void> {
    const def = UPSCALE_MODELS[id]
    await mkdir(this.dir, { recursive: true })
    const finalPath = this.pathFor(id)
    const partPath = `${finalPath}.part`

    const res = await fetch(def.url, { headers: { 'User-Agent': 'frameplayer' }, redirect: 'follow' })
    if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${def.label}`)

    const total = Number(res.headers.get('content-length')) || 0
    let received = 0
    // Count bytes as they stream past, then forward them unchanged to disk.
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb): void {
        received += chunk.length
        onProgress?.(received, total)
        cb(null, chunk)
      }
    })
    // res.body is a web ReadableStream; adapt it to a Node stream.
    const body = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0])

    try {
      await pipeline(body, counter, createWriteStream(partPath))
      await this.assertLooksLikeOnnx(partPath, def.label)
      await rename(partPath, finalPath)
    } catch (err) {
      await rm(partPath, { force: true })
      throw err
    }
  }

  /** Cheap sanity check that the download is a real ONNX file, not an error page. */
  private async assertLooksLikeOnnx(path: string, label: string): Promise<void> {
    const info = await stat(path)
    // ONNX models are protobufs at least kilobytes in size; an HTML/JSON error
    // body would be far smaller. (Full validation happens when the session loads.)
    if (info.size < 4096) {
      throw new Error(`Downloaded ${label} looks invalid (${info.size} bytes)`)
    }
  }
}
