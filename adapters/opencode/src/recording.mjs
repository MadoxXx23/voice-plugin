import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// One capture at a time; no shell and no injection of text into terminal input.
export class RecordingSession {
  constructor(binary, rpc, onState = () => {}) {
    this.binary = binary; this.rpc = rpc; this.onState = onState
    this.state = 'idle'; this.child = null; this.dir = null
  }
  async toggle() {
    if (this.state === 'idle') return this.start()
    if (this.state === 'recording') return this.stop()
    return null
  }
  async start() {
    if (this.state !== 'idle') return
    this.state = 'starting'; this.onState('starting')
    try {
      this.dir = await mkdtemp(join(tmpdir(), 'voice-plugin-record-'))
      const path = join(this.dir, 'recording.wav')
      const child = spawn(this.binary, ['capture', path], { shell:false, stdio:['pipe','pipe','pipe'] })
      this.child = child
      let buffered = '', errors = ''
      child.stderr.setEncoding('utf8');child.stderr.on('data', x => {errors=(errors+x).slice(-4096)})
      await new Promise((resolve,reject) => {
        let settled = false
        const timer = setTimeout(() => fail(new Error('Microphone did not start within 10 seconds')),10000)
        const fail = e => {if(settled)return;settled=true;clearTimeout(timer);reject(e)}
        child.once('error',fail)
        child.once('exit', code => fail(new Error(`Audio capture exited (${code}): ${errors}`)))
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', data => {
          buffered+=data
          if(buffered.includes('READY\n')&&!settled){settled=true;clearTimeout(timer);resolve()}
        })
      })
      this.state='recording';this.onState('recording')
    } catch(err){await this.cleanup();throw err}
  }
  async stop() {
    if(this.state!=='recording')return null
    this.state='transcribing';this.onState('transcribing')
    const child=this.child;const path=join(this.dir,'recording.wav')
    try {
      const exited=new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{child.kill();reject(new Error('Audio capture did not stop'))},5000)
        child.once('error',e=>{clearTimeout(timer);reject(e)})
        child.once('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error(`Audio capture stopped with exit ${code}`))})
      })
      child.stdin.end('\n')
      await exited
      return await this.rpc('voice.transcribe',{path})
    } finally {await this.cleanup()}
  }
  async cleanup() {
    if(this.child && this.child.exitCode===null){this.child.kill()}
    if(this.dir)await rm(this.dir,{recursive:true,force:true})
    this.child=null;this.dir=null;this.state='idle';this.onState('idle')
  }
}
