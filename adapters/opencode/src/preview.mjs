// Guarded OpenTUI composer bridge for OpenCode v2.
// OpenTUI exposes plainText as a property, not necessarily getText() as a method.
function readComposerText(control) {
  if (typeof control?.plainText === 'string') return control.plainText
  if (typeof control?.getText === 'function') return control.getText()
  return undefined
}

export async function insertTranscript({ text, renderer, toast }) {
  const transcript = String(text || '').trim()
  if (!transcript) return { status: 'empty' }
  const focused = renderer?.currentFocusedRenderable
  if (!focused || typeof focused.insertText !== 'function' ||
      typeof readComposerText(focused) !== 'string') {
    throw new Error('OpenCode v2 focused control is not an editable text composer (insertText/plainText unavailable). Transcription was not inserted or sent.')
  }
  const before = readComposerText(focused)
  await focused.insertText(transcript)
  const after = readComposerText(focused)
  if (typeof after !== 'string' || after === before || !after.includes(transcript)) {
    throw new Error('OpenCode composer did not acknowledge inserted text. Check the draft before retrying.')
  }
  toast?.show({ message: 'Voice text inserted into input — press Enter to send', variant: 'success' })
  return { status: 'inserted' }
}
