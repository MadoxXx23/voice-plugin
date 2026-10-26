#!/usr/bin/env node
/** Offline, version-aware upgrade from a downloaded Voice Agent release directory. */
import { readFile, cp, rm, mkdtemp, mkdir, rename, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { homedir, tmpdir, platform } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup } from './install-opencode.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
export const parseVersion = value => {
  const match = /^0\.1\.0-alpha\.(\d+)$/.exec(value)
  if (!match) throw new Error(`Unsupported version: ${value}`)
  return Number(match[1])
}
export function compareVersions(current, target) {
  return Math.sign(parseVersion(target) - parseVersion(current))
}
export async function versionAt(path) {
  try { return JSON.parse(await readFile(path, 'utf8')).version || null }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}
async function restore(source, target, existed) {
  await rm(target, { recursive: true, force: true })
  if (existed) await cp(source, target, { recursive: true })
}
export async function update({ sourceDir = root, configDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode'), binDir = join(homedir(), '.local', 'bin'), allowDowngrade = false, installFn = setup } = {}) {
  const source = resolve(sourceDir)
  const targetVersion = await versionAt(join(source, 'adapters/opencode/package.json'))
  if (!targetVersion) throw new Error('Source release has no version')
  const pluginDir = join(configDir, 'voice-agent-plugin')
  const currentVersion = await versionAt(join(pluginDir, 'package.json'))
  if (currentVersion && compareVersions(currentVersion, targetVersion) < 0 && !allowDowngrade) {
    throw new Error(`Refusing downgrade ${currentVersion} -> ${targetVersion}; use --allow-downgrade explicitly`)
  }
  if (currentVersion === targetVersion) return { currentVersion, targetVersion, changed: false }
  const binary = join(binDir, platform() === 'win32' ? 'voice-agent.exe' : 'voice-agent')
  const config = join(configDir, 'cli.json')
  const targets = [binary, pluginDir, config]
  const temporary = await mkdtemp(join(tmpdir(), 'voice-agent-update-'))
  const present = targets.map(existsSync)
  try {
    for (let i = 0; i < targets.length; i++) if (present[i]) await cp(targets[i], join(temporary, String(i)), { recursive: true })
    try {
      // Install only from this local, checksum-verified release. Preserve model/config.
      const result = await installFn({ configDir, binDir, releaseDir: join(source, 'dist/releases'), version: targetVersion, projectDir: source })
      return { currentVersion, targetVersion, changed: true, ...result }
    } catch (error) {
      for (let i = 0; i < targets.length; i++) await restore(join(temporary, String(i)), targets[i], present[i])
      throw new Error(`Upgrade failed; previous installation restored: ${error.message}`)
    }
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const opt = key => { const index = args.indexOf(key); return index < 0 ? undefined : args[index + 1] }
  update({ sourceDir: opt('--source-dir') || root, configDir: opt('--config-dir') || undefined, binDir: opt('--bin-dir') || undefined, allowDowngrade: args.includes('--allow-downgrade') })
    .then(result => console.log(result.changed ? `Updated ${result.currentVersion || '(not installed)'} -> ${result.targetVersion}. Restart OpenCode.` : `Already at ${result.targetVersion}; no changes.`))
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
