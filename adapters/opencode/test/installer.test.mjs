import test from 'node:test'
import assert from 'node:assert/strict'
import {platformTarget,expectedChecksum} from '../scripts/install-binary.mjs'
test('platform mapping',()=>{
 assert.deepEqual(platformTarget('darwin','arm64'),{os:'darwin',cpu:'arm64',ext:'.tar.gz',exe:'voice-agent'})
 assert.deepEqual(platformTarget('win32','x64'),{os:'windows',cpu:'amd64',ext:'.zip',exe:'voice-agent.exe'})
 assert.throws(()=>platformTarget('freebsd','x64'),/Unsupported/)
})
test('checksum parsing',()=>{
 const hash='a'.repeat(64)
 assert.equal(expectedChecksum(`${hash}  example.zip\n`,'example.zip'),hash)
 assert.throws(()=>expectedChecksum('', 'example.zip'), /No SHA256/)
})
