import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { clipboardCandidates, copyToClipboard } from '../src/clipboard.mjs'

test('platform-specific clipboard candidates', () => {
  assert.equal(clipboardCandidates('darwin')[0][0], 'pbcopy')
  assert.equal(clipboardCandidates('win32')[0][0], 'clip.exe')
  assert.equal(clipboardCandidates('linux', { WAYLAND_DISPLAY: 'wayland-1' })[0][0], 'wl-copy')
  assert.equal(clipboardCandidates('linux', {})[0][0], 'xclip')
})

test('clipboard passes transcription via stdin without a shell', async () => {
  let written = ''
  let command = ''
  const spawnProcess = (cmd, args, opts) => {
    command = cmd
    assert.equal(opts.shell, false)
    const child = new EventEmitter()
    child.stderr = new EventEmitter()
    child.stdin = new EventEmitter()
    child.stdin.end = text => { written = text; queueMicrotask(() => child.emit('close', 0)) }
    child.kill = () => {}
    return child
  }
  await copyToClipboard('hello; $(rm -rf /)', { platform: 'darwin', spawnProcess })
  assert.equal(command, 'pbcopy')
  assert.equal(written, 'hello; $(rm -rf /)')
})

test('rejects empty or oversized input', async () => {
  await assert.rejects(copyToClipboard(' '), /No transcription/)
  await assert.rejects(copyToClipboard('a'.repeat(65537)), /too large/)
})
