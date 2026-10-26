#!/usr/bin/env node
/** macOS installer. Downloads only the pinned, SHA256-verified Whisper model. */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { arch, platform } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setup } from './install-opencode.mjs'
import { installModel, saveModelConfig, appDir, modelPath, validModel } from './whisper-model.mjs'

export function macPrerequisites({ find = command => spawnSync('/usr/bin/which', [command], { encoding: 'utf8' }).status === 0 } = {}) {
  return { homebrew: find('brew'), sox: find('sox'), whisper: find('whisper-cli') }
}
export function installCommands(checks) {
  const missing = []
  if (!checks.homebrew) missing.push('Install Homebrew from https://brew.sh/ (manual step).')
  if (!checks.sox || !checks.whisper) missing.push('After Homebrew is installed: brew install sox whisper-cpp')
  return missing
}
export async function main({ platformName = platform(), cpu = arch(), releaseDir, configDir, binDir, dataDir = appDir(), offline = false, installModelFn = installModel } = {}) {
  if (platformName !== 'darwin') throw new Error('This installer is for macOS only. Use scripts/install-opencode.mjs on other systems.')
  if (!['arm64', 'x64'].includes(cpu)) throw new Error(`Unsupported Mac architecture: ${cpu}`)
  console.log(`Voice Agent macOS setup (${cpu === 'arm64' ? 'Apple Silicon' : 'Intel'})`)
  const result = await setup({ releaseDir, configDir, binDir })
  const checks = macPrerequisites()
  let model = process.env.WHISPER_MODEL
  if (model && !existsSync(model)) throw new Error(`WHISPER_MODEL does not exist: ${model}`)
  if (!model) {
    if (offline) {
      const cached = modelPath(dataDir)
      if (await validModel(cached)) model = cached
      else console.log('Offline mode: no verified bundled model. Set WHISPER_MODEL or rerun without --offline.')
    } else {
      console.log('Installing Whisper Base multilingual (~148 MB) from Hugging Face; verifying SHA256...')
      const installed = await installModelFn({ dir: dataDir })
      model = installed.path
      console.log(`Whisper model: ${model} (${installed.downloaded ? 'downloaded' : 'already present'})`)
    }
  }
  if (model) console.log(`Model configuration: ${await saveModelConfig(model, { dir: dataDir })}`)
  console.log(`Go binary: ${result.binaryPath}\nOpenCode TUI adapter: ${result.pluginsDir}\nConfiguration: ${result.registration.path}`)
  console.log(`Run: '${result.binaryPath}' doctor`)
  const missing = installCommands(checks)
  if (missing.length) console.log(`Remaining manual prerequisites:\n- ${missing.join('\n- ')}`)
  console.log('Allow microphone access for your terminal in System Settings > Privacy & Security > Microphone.')
  return { ...result, checks, model }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i+1] }
  main({ releaseDir: option('--release-dir'), configDir: option('--config-dir'), binDir: option('--bin-dir'), offline: args.includes('--offline') })
    .catch(error => { console.error(error.message); process.exitCode = 1 })
}
