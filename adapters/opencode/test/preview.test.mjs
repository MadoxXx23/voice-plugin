import test from 'node:test'
import assert from 'node:assert/strict'
import { insertTranscript } from '../src/preview.mjs'
const toast = { show() {} }
function composer(initial = '') {
  return { plainText: initial, insertText(text) { this.plainText += text } }
}
test('OpenTUI plainText composer inserts transcription into existing draft', async () => {
  const input = composer('existing ')
  const result = await insertTranscript({text:' Yes, we are working. ',renderer:{currentFocusedRenderable:input},toast})
  assert.equal(result.status, 'inserted')
  assert.equal(input.plainText, 'existing Yes, we are working.')
})
test('OpenTUI plainText empty composer accepts insertion', async () => {
  const input = composer()
  await insertTranscript({text:'One two three',renderer:{currentFocusedRenderable:input},toast})
  assert.equal(input.plainText, 'One two three')
})
test('Legacy getText composer remains compatible', async () => {
  let value = ''
  const input = {getText: () => value, insertText: text => {value += text}}
  await insertTranscript({text:'hello',renderer:{currentFocusedRenderable:input},toast})
  assert.equal(value, 'hello')
})
test('plainText takes precedence when getText exists but is broken', async () => {
  const input = {plainText:'a', getText(){throw new Error('legacy method unsupported')},insertText(text){this.plainText += text}}
  await insertTranscript({text:'b',renderer:{currentFocusedRenderable:input},toast})
  assert.equal(input.plainText, 'ab')
})
test('Missing composer fails clearly', async () => {
  await assert.rejects(insertTranscript({text:'hello',renderer:{},toast}),/not an editable text composer/)
})
test('Unrelated focused control is rejected', async () => {
  await assert.rejects(insertTranscript({text:'hello',renderer:{currentFocusedRenderable:{insertText() {}}},toast}),/not an editable text composer/)
})
test('No update is not reported as success', async () => {
  await assert.rejects(insertTranscript({text:'hello',renderer:{currentFocusedRenderable:{insertText() {},plainText:''}},toast}),/did not acknowledge/)
})
test('Whitespace transcript is ignored', async () => {
  const result = await insertTranscript({text:'   ',renderer:{},toast})
  assert.equal(result.status,'empty')
})
