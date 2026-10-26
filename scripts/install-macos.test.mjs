import test from 'node:test'
import assert from 'node:assert/strict'
import { installCommands } from './install-macos.mjs'
test('missing commands are actionable, model is automatically handled', () => {
 const missing = installCommands({ homebrew:true, sox:false, whisper:false })
 assert.equal(missing.length,1)
 assert.match(missing[0],/brew install sox whisper-cpp/)
})
test('complete prerequisites', () => assert.deepEqual(installCommands({homebrew:true,sox:true,whisper:true}),[]))
