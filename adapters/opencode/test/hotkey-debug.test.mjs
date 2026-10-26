import test from 'node:test'
import assert from 'node:assert/strict'
import { hotkeyReport } from '../src/hotkey-debug.mjs'

test('diagnostics distinguish observed handler from unseen OS/terminal layers', async () => {
  const report = await hotkeyReport({ os: 'darwin', terminal: 'iTerm.app', lastInvoked: '2026-10-26T13:00:00Z', now: new Date('2026-10-26T13:01:00Z'), read: async () => JSON.stringify({keybinds:{'voice-plugin.record':'super+shift+r'}}) })
  assert.match(report, /super\+shift\+r/)
  assert.match(report, /Last record action invoked: 2026-10-26T13:00:00.000Z/)
  assert.match(report, /cannot observe global macOS keystrokes/)
})
test('missing settings and disabled bindings reported without guessing', async () => {
  const missing = await hotkeyReport({os:'linux',read:async()=>{const e = new Error('missing'); e.code='ENOENT';throw e}})
  assert.match(missing,/ctrl\+alt\+r/)
  const disabled = await hotkeyReport({os:'win32',read:async()=>JSON.stringify({keybinds:{'voice-plugin.record':'none'}})})
  assert.match(disabled,/voice-plugin.record: none/)
})
