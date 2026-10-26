import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const root = new URL('../adapters/opencode/src/', import.meta.url)
test('one configurable record action and short slash command', async () => {
  const tui = await readFile(new URL('tui.ts', root), 'utf8')
  const status = await readFile(new URL('status.tsx', root), 'utf8')
  assert.match(tui, /id: 'voice-agent\.record'/)
  assert.match(tui, /slash: \{name: 'r'\}/)
  assert.doesNotMatch(tui, /bind: 'ctrl\+g'|bind: 'super\+shift\+r'/)
  assert.doesNotMatch(tui, /voice-agent\.record\.mac/)
  assert.match(status, /<text fg="#ff4545">● REC/)
  assert.match(status, /\/r to stop/)
})

test('hotkey debug command is registered and installed', async () => {
  const tui = await readFile(new URL('tui.ts', root), 'utf8')
  const installer = await readFile(new URL('./install-opencode.mjs', import.meta.url), 'utf8')
  assert.match(tui, /slash: \{name: 'hotkey_record_debug'\}/)
  assert.match(tui, /lastRecordInvocation = new Date\(\)\.toISOString\(\)/)
  assert.match(installer, /hotkey-debug\.mjs/)
})
