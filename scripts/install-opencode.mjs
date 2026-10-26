#!/usr/bin/env node
import { readFile, writeFile, mkdir, copyFile, rename, stat, mkdtemp, rm } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { install } from '../adapters/opencode/scripts/install-binary.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultConfigDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode')
export const RECORD_COMMAND = 'voice-agent.record'
export const DEFAULT_KEYBINDS = Object.freeze({
  darwin: 'super+shift+r',
  linux: 'ctrl+alt+r',
  win32: 'ctrl+shift+r',
})

export function defaultRecordKeybind(os = platform()) {
  return DEFAULT_KEYBINDS[os] || 'ctrl+shift+r'
}

export function addPlugin(config, pluginPath, os = platform()) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('cli.json must be a JSON object')
  if (config.plugins !== undefined && !Array.isArray(config.plugins)) throw new Error('cli.json plugins must be an array')
  if (config.keybinds !== undefined && (!config.keybinds || typeof config.keybinds !== 'object' || Array.isArray(config.keybinds))) {
    throw new Error('cli.json keybinds must be an object')
  }
  const plugins = config.plugins || []
  const keybinds = { ...(config.keybinds || {}) }
  // A user override (including "none" or false) always takes precedence.
  if (!Object.hasOwn(keybinds, RECORD_COMMAND)) keybinds[RECORD_COMMAND] = defaultRecordKeybind(os)
  return {
    ...config,
    plugins: plugins.some(p => p === pluginPath || (p && typeof p === 'object' && p.package === pluginPath)) ? plugins : [...plugins, pluginPath],
    keybinds,
  }
}
export async function configure({ configDir = defaultConfigDir, pluginPath, os = platform() }) {
  const path = join(configDir, 'cli.json')
  await mkdir(configDir, { recursive: true })
  let raw = null, existing = {}
  try { raw = await readFile(path, 'utf8'); existing = JSON.parse(raw) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  const updated = JSON.stringify(addPlugin(existing, pluginPath, os), null, 2) + '\n'
  if (raw === updated) return { path, changed: false }
  if (raw !== null) await copyFile(path, path + '.voice-agent.bak')
  const temp = join(configDir, `.cli.json.voice-agent.${process.pid}.tmp`)
  try { await writeFile(temp, updated, { flag: 'wx', mode: 0o600 }); await rename(temp, path) }
  finally { await rm(temp, { force: true }) }
  return { path, changed: true }
}
export async function setup({ configDir = defaultConfigDir, binDir = join(homedir(), '.local', 'bin'), releaseDir = join(root,'dist','releases'), version = '0.1.0-alpha.23', projectDir = root } = {}) {
  const binaryPath = await install({ releaseDir, version, dest: binDir })
  const pluginsDir = join(configDir, 'voice-agent-plugin')
  await mkdir(pluginsDir, { recursive: true })
  for (const f of ['index.ts','tui.ts','clipboard.mjs','recording.mjs','preview.mjs','status.tsx','hotkey-debug.mjs']) await copyFile(join(projectDir,'adapters','opencode','src', f), join(pluginsDir,f))
  await writeFile(join(pluginsDir, 'package.json'), JSON.stringify({name:'opencode-voice-agent-local',version,type:'module',exports:{'.':'./index.ts','./tui':'./tui.ts'}},null,2)+'\n')
  // CLI-only plugin: register under cli.json; do not load server entrypoint.
  const registration = await configure({ configDir, pluginPath: pluginsDir })
  return { binaryPath, pluginsDir, registration }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const opt = key => { const i=args.indexOf(key); return i < 0 ? undefined : args[i+1] }
  setup({ configDir: opt('--config-dir') || undefined, binDir: opt('--bin-dir') || undefined, releaseDir: opt('--release-dir') || undefined }).then(({binaryPath,pluginsDir,registration}) => {
    console.log(`Installed Go binary: ${binaryPath}\nPlugin: ${pluginsDir}\nConfig: ${registration.path}`)
    console.log(`Ensure ${binaryPath} is on PATH (or set VOICE_AGENT_BIN), then restart OpenCode.`)
  }).catch(err => { console.error(`Install failed: ${err.message}`); process.exitCode=1 })
}
