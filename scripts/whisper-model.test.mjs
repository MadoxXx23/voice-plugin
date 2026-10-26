import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { installModel, saveModelConfig, modelPath, validModel } from './whisper-model.mjs'
test('downloads, verifies and reuses model without a second request', async () => {
 const dir = await mkdtemp(join(tmpdir(),'voice-agent-model-'))
 const content = Buffer.from('fake-whisper-model')
 const sha256 = createHash('sha256').update(content).digest('hex')
 let count = 0
 const fetchImpl = async () => { count++; return new Response(content,{status:200}) }
 try {
  const first = await installModel({dir,url:'https://example.invalid/model',sha256,bytes:content.length,fetchImpl})
  assert.equal(first.downloaded,true)
  assert.equal(await validModel(first.path,{sha256,bytes:content.length}),true)
  const second = await installModel({dir,sha256,bytes:content.length,fetchImpl})
  assert.equal(second.downloaded,false)
  assert.equal(count,1)
  const target = await saveModelConfig(first.path,{dir})
  const config = JSON.parse(await readFile(target,'utf8'))
  assert.equal(config.stt.modelPath,modelPath(dir))
 } finally { await rm(dir,{recursive:true,force:true}) }
})
test('rejects tampered downloads without leaving a model', async () => {
 const dir = await mkdtemp(join(tmpdir(),'voice-agent-model-'))
 try {
  await assert.rejects(installModel({dir,bytes:4,sha256:'a'.repeat(64),fetchImpl:async()=>new Response('bad!')}),/checksum/)
  assert.equal(await validModel(modelPath(dir),{bytes:4,sha256:'a'.repeat(64)}),false)
 } finally { await rm(dir,{recursive:true,force:true}) }
})
