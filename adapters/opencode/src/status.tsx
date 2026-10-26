import { createSignal } from 'solid-js'

// Slot is rendered by OpenCode; no terminal control sequences or screen writes.
export function installRecordingStatus(ctx: any) {
  const [state, setState] = createSignal('idle')
  const render = () => {
    const current = state()
    if (current === 'idle') return <text>VOICE READY</text>
    if (current === 'starting') return <text>VOICE: STARTING…</text>
    if (current === 'recording') return <text fg="#ff4545">● REC · /r to stop</text>
    return <text>VOICE: TRANSCRIBING…</text>
  }
  const disposeHome = ctx.ui.slot({ append: 'home.footer.status', render })
  const disposePrompt = ctx.ui.slot({ append: 'prompt.footer.status', render })
  return { setState, dispose: () => { disposeHome?.(); disposePrompt?.() } }
}
