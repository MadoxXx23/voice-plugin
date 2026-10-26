/** Diagnostic observations, not a claim to observe macOS/iTerm2 key interception. */
import { readFile } from 'node:fs/promises'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

export const ACTION = 'voice-agent.record'
export const DEFAULTS = { darwin: 'super+shift+r', linux: 'ctrl+alt+r', win32: 'ctrl+shift+r' }

export async function hotkeyReport({ configDir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'opencode'), os = platform(), terminal = process.env.TERM_PROGRAM || 'unknown', lastInvoked = null, now = new Date(), read = readFile } = {}) {
  let configured = DEFAULTS[os] || 'ctrl+shift+r'
  let configStatus = 'file absent (using expected OS default)'
  try {
    const cfg = JSON.parse(await read(join(configDir, 'cli.json'), 'utf8'))
    if (Object.hasOwn(cfg.keybinds || {}, ACTION)) {
      configured = String(cfg.keybinds[ACTION])
      configStatus = 'explicit keybind in cli.json'
    } else configStatus = 'no explicit binding in cli.json (expected OS default)'
  } catch (err) {
    if (err?.code !== 'ENOENT') configStatus = `could not read cli.json (${err?.name || 'error'})`
  }
  const last = lastInvoked ? new Date(lastInvoked).toISOString() : 'not observed in this plugin instance'
  return [
    'Voice Agent — Hotkey Diagnostic',
    `Platform: ${os}`,
    `Terminal: ${terminal}`,
    `Configured ${ACTION}: ${configured}`,
    `Configuration: ${configStatus}`,
    'TUI plugin: ACTIVE (this dialog confirms the slash-command handler ran)',
    `Last record action invoked: ${last}`,
    `Diagnostic time: ${now.toISOString()}`,
    '',
    'How to isolate the failure:',
    '1. Run /r; recording should toggle. This proves the record handler works.',
    '2. Press the physical hotkey, then run /hotkey_record_debug again.',
    '3. If the timestamp does not change, the key event did not reach this handler.',
    '4. In iTerm2 check Settings > Profiles > Keys > Key Mappings and the keyboard shortcut conflicts.',
    '5. To test a remap, map Command+Shift+R to Send Hex Code 0x07 and set voice-agent.record to ctrl+g in cli.json, then restart OpenCode.',
    '',
    'LIMITATION: The plugin cannot observe global macOS keystrokes, iTerm2 interception, or other OpenCode handlers. It cannot identify the exact intercepting application.',
  ].join('\n')
}
