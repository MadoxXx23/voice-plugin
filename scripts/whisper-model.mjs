import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat, readFile, writeFile, chmod } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const MODEL_SHA256 = '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe'
export const MODEL_BYTES = 147951465
export const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin'
export const appDir = () => join(homedir(), 'Library', 'Application Support', 'VoiceAgent')
export const configPath = (dir = appDir()) => join(dir, 'config.json')
export const modelPath = (dir = appDir()) => join(dir, 'models', 'whisper', 'ggml-base.bin')

export async function digestFile(path) {
  const { createReadStream } = await import('node:fs')
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
export async function validModel(path, { sha256 = MODEL_SHA256, bytes = MODEL_BYTES } = {}) {
  try {
    const info = await stat(path)
    return info.isFile() && info.size === bytes && (await digestFile(path)) === sha256
  } catch (e) { if (e.code === 'ENOENT') return false; throw e }
}
export async function installModel({ dir = appDir(), url = MODEL_URL, sha256 = MODEL_SHA256, bytes = MODEL_BYTES, fetchImpl = fetch } = {}) {
  const destination = modelPath(dir)
  if (await validModel(destination, { sha256, bytes })) return { path: destination, downloaded: false }
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
  const temp = `${destination}.${process.pid}.${Date.now()}.part`
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(300_000) })
    if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`)
    const stream = Readable.fromWeb(response.body)
    await pipeline(stream, createWriteStream(temp, { flags: 'wx', mode: 0o600 }))
    if (!await validModel(temp, { sha256, bytes })) throw new Error('Model checksum or size mismatch; download rejected')
    await rename(temp, destination)
    await chmod(destination, 0o600)
    return { path: destination, downloaded: true }
  } finally { await rm(temp, { force: true }) }
}
export async function saveModelConfig(path, { dir = appDir() } = {}) {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const target = configPath(dir)
  let config = {}
  try { config = JSON.parse(await readFile(target, 'utf8')) } catch (e) { if (e.code !== 'ENOENT') throw e }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid VoiceAgent config')
  const updated = { ...config, stt: { ...(config.stt || {}), provider: 'whisper.cpp', model: 'base', modelPath: resolve(path), language: 'auto' } }
  const tmp = `${target}.${process.pid}.tmp`
  try { await writeFile(tmp, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); await rename(tmp, target) }
  finally { await rm(tmp, { force: true }) }
  return target
}
