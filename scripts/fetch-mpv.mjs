// Downloads an official Windows mpv build and extracts it into resources/mpv,
// so the app has a bundled engine (per the briefing). Reproducible and
// self-contained: uses the 7za binary shipped by the 7zip-bin dev dependency,
// so it needs neither admin rights nor a system 7-Zip install.
//
// Usage: npm run fetch:mpv
//
// Source: https://github.com/zhongfly/mpv-winbuild (official mpv.io-listed
// Windows builds). We pick the generic x86_64 player build (not the AVX2 "v3"
// build, the 32-bit i686 build, or the libmpv "dev" archive).

import { createWriteStream } from 'node:fs'
import { mkdir, rm, readdir, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { path7za } from '7zip-bin'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const destDir = join(repoRoot, 'resources', 'mpv')
const releasesApi = 'https://api.github.com/repos/zhongfly/mpv-winbuild/releases/latest'
const ASSET_PATTERN = /^mpv-x86_64-\d{8}.*\.7z$/

async function main() {
  console.log('Resolving latest mpv Windows build…')
  const asset = await resolveAsset()
  console.log(`Selected: ${asset.name} (${(asset.size / 1_048_576).toFixed(1)} MB)`)

  await mkdir(destDir, { recursive: true })
  const archivePath = join(destDir, asset.name)

  console.log('Downloading…')
  await download(asset.browser_download_url, archivePath)

  console.log('Extracting…')
  await extract(archivePath, destDir)
  await rm(archivePath, { force: true })

  await verify()
  console.log(`\nDone. mpv is bundled in ${destDir}`)
}

async function resolveAsset() {
  const res = await fetch(releasesApi, {
    headers: { 'User-Agent': 'frameplayer-fetch-mpv', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`)

  const release = await res.json()
  const asset = (release.assets ?? []).find((a) => ASSET_PATTERN.test(a.name))
  if (!asset) {
    const names = (release.assets ?? []).map((a) => a.name).join(', ')
    throw new Error(`No matching x86_64 player asset in release ${release.tag_name}. Saw: ${names}`)
  }
  return asset
}

async function download(url, outPath) {
  const res = await fetch(url, { headers: { 'User-Agent': 'frameplayer-fetch-mpv' } })
  if (!res.ok || !res.body) throw new Error(`Download failed (${res.status}) for ${url}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath))
}

function extract(archivePath, outDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(path7za, ['x', archivePath, `-o${outDir}`, '-y'], { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`7za exited with code ${code}`))
    )
  })
}

async function verify() {
  const mpvExe = join(destDir, 'mpv.exe')
  try {
    const info = await stat(mpvExe)
    if (!info.isFile()) throw new Error('mpv.exe is not a file')
  } catch {
    const contents = (await readdir(destDir)).join(', ')
    throw new Error(`mpv.exe not found after extraction. resources/mpv contains: ${contents}`)
  }
}

main().catch((err) => {
  console.error(`\nfetch-mpv failed: ${err.message}`)
  process.exit(1)
})
