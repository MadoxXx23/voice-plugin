import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RecordingSession } from '../src/recording.mjs'

test('toggle start/stop transcribes and cleans audio', async () => {
  const dir=await mkdtemp(join(tmpdir(),'voice-plugin-toggle-test-'))
  try {
    const bin=join(dir,'fake-capture')
    await writeFile(bin, '#!/usr/bin/env node\nconst fs=require("node:fs");const path=process.argv[3];fs.writeFileSync(path,Buffer.alloc(200));console.log("READY");process.stdin.once("data",()=>process.exit(0));\n', {mode:0o755})
    await chmod(bin,0o755)
    let called=false
    const s=new RecordingSession(bin, async (method,params)=> {assert.equal(method,'voice.transcribe');called=true;return {text:'Hello voice'} })
    assert.equal(await s.toggle(),undefined)
    assert.equal(s.state,'recording')
    assert.deepEqual(await s.toggle(),{text:'Hello voice'})
    assert.equal(s.state,'idle');assert.equal(s.dir,null);assert.equal(called,true)
  } finally {await rm(dir,{recursive:true,force:true})}
})
