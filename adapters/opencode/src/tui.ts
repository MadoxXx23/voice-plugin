import { Plugin } from '@opencode/plugin/tui'
import { spawn } from 'node:child_process'
import { insertTranscript } from './preview.mjs'
import { installRecordingStatus } from './status.tsx'
import { RecordingSession } from './recording.mjs'
import { hotkeyReport } from './hotkey-debug.mjs'

// Binary discovery is intentionally explicit; no downloads or shell execution.
const binary = process.env.VOICE_AGENT_BIN || 'voice-agent'

interface Reply { jsonrpc: '2.0'; id: number; result?: {text?: string; [key:string]:unknown}; error?: {code:number; message:string} }
function request(method: string, params: Record<string, unknown> = {}): Promise<Reply['result']> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['serve'], { stdio: ['pipe', 'pipe', 'pipe'], shell: false })
    const timer = setTimeout(() => { child.kill(); reject(new Error('voice-agent timed out')) }, method === 'voice.record' ? 150_000 : 15_000)
    let stdout = '', stderr = '', done = false
    function finish(error?: Error, result?: Reply['result']) {
      if (done) return
      done = true; clearTimeout(timer); child.kill()
      if (error) reject(error); else resolve(result)
    }
    child.on('error', (error) => finish(error))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (data) => { stderr += data; if (stderr.length > 4096) stderr = stderr.slice(-4096) })
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (data: string) => {
      stdout += data
      const newline = stdout.indexOf('\n')
      if (newline < 0) return
      try {
        const reply = JSON.parse(stdout.slice(0, newline)) as Reply
        if (reply.error) finish(new Error(reply.error.message))
        else finish(undefined, reply.result)
      } catch (error) { finish(error as Error) }
    })
    child.on('close', (code) => finish(new Error(`voice-agent exited ${code}: ${stderr}`)))
    child.stdin.end(JSON.stringify({jsonrpc:'2.0',id:1,method,params}) + '\n')
  })
}

export default Plugin.define({
  id: 'voice-agent.tui',
  setup(ctx) {
    const status = installRecordingStatus(ctx)
    const session = new RecordingSession(binary, request, (state) => {
      status.setState(state)
      if (state === 'recording') ctx.ui.toast.show({message:'Recording... use your Voice Agent shortcut or /r to stop',variant:'info'})
      if (state === 'transcribing') ctx.ui.toast.show({message:'Transcribing voice...',variant:'info'})
    })
    let lastRecordInvocation: string | null = null
    const toggleRecording = async () => {
      lastRecordInvocation = new Date().toISOString()
      try {
        const response = await session.toggle()
        if (!response) return
        const transcript = response.text?.trim() || ''
        if (!transcript) {
          await ctx.ui.dialog.alert({title: 'Voice Agent', message: 'No speech recognized.'})
          return
        }
        try {
          await insertTranscript({
            text: transcript,
            renderer: ctx.renderer, toast: ctx.ui.toast,
          })
        } catch (error) {
          await ctx.ui.dialog.alert({
            title: 'Voice Agent — insert failed',
            message: `${String(error)}\n\nYour transcription:\n${transcript}`,
          })
        }
      } catch (error) {
        ctx.ui.toast.show({message: String(error), variant: 'error'})
      }
    }
    ctx.keymap.layer(() => ({
      mode: 'global', priority: 10,
      commands: [
        {
          id: 'voice-agent.record', title: 'Toggle voice recording', group: 'Voice Agent',
          palette: true, slash: {name: 'r'},
          run: toggleRecording,
        },
        {
          id: 'voice-agent.hotkey_record_debug', title: 'Diagnose voice recording hotkey', group: 'Voice Agent',
          palette: true, slash: {name: 'hotkey_record_debug'},
          run: async () => {
            const message = await hotkeyReport({lastInvoked: lastRecordInvocation})
            await ctx.ui.dialog.alert({title: 'Voice Agent — Hotkey Debug', message})
          },
        },
        {
          id:'voice-agent.doctor', title:'Check Voice Agent', group:'Voice Agent',
          palette:true, slash:{name:'voice-doctor'},
          run: async () => {
            try {const report = await request('voice.doctor'); await ctx.ui.dialog.alert({title:'Voice Agent Doctor', message:JSON.stringify(report,null,2)})}
            catch(error){ctx.ui.toast.show({message:String(error),variant:'error'})}
          }
        }
      ],
      bindings: ['voice-agent.record', 'voice-agent.hotkey_record_debug', 'voice-agent.doctor'],
    }))
    return () => { void session.cleanup(); status.dispose() }
  }
})
