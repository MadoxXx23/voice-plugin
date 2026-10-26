import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir, platform } from 'node:os'
import { join } from 'node:path'
import { addPlugin, configure, setup, defaultRecordKeybind } from './install-opencode.mjs'

test('config preserves existing plugins and other fields', () => {
 const config = addPlugin({theme:'x',plugins:['example']},'/plugins/voice')
 assert.deepEqual(config,{theme:'x',plugins:['example','/plugins/voice'],keybinds:{'voice-plugin.record':defaultRecordKeybind()}})
 assert.equal(addPlugin(config,'/plugins/voice').plugins.length,2)
 assert.throws(()=>addPlugin({plugins:'bad'},'x'),/array/)
 assert.throws(()=>addPlugin({keybinds:[]},'x'),/object/)
})
test('config backup, idempotency and invalid config', async () => {
 const dir = await mkdtemp(join(tmpdir(),'voice-test-'))
 try {
  await writeFile(join(dir,'cli.json'),JSON.stringify({plugins:['keep'],debug:{timing:true}}))
  await configure({configDir:dir,pluginPath:'/voice'})
  assert.deepEqual(JSON.parse(await readFile(join(dir,'cli.json'),'utf8')).plugins,['keep','/voice'])
  assert.match(await readFile(join(dir,'cli.json.voice-plugin.bak'),'utf8'),/keep/)
  assert.equal(JSON.parse(await readFile(join(dir,'cli.json'),'utf8')).keybinds['voice-plugin.record'], defaultRecordKeybind())
  const result = await configure({configDir:dir,pluginPath:'/voice'})
  assert.equal(result.changed,false)
  await writeFile(join(dir,'cli.json'),'{broken')
  await assert.rejects(configure({configDir:dir,pluginPath:'/voice'}),SyntaxError)
 } finally { await rm(dir,{recursive:true,force:true}) }
})
test('end-to-end local installation with stubbed binary', async () => {
 const dir = await mkdtemp(join(tmpdir(),'voice-test-'))
 try {
  const result = await setup({configDir:join(dir,'config'),binDir:join(dir,'bin'),installFn: async ({dest}) => {
   await mkdir(dest,{recursive:true})
   const binary=join(dest,platform()==='win32'?'voice-plugin.exe':'voice-plugin')
   await writeFile(binary,'stub')
   return binary
  }})
  assert.match(await readFile(join(result.pluginsDir,'tui.ts'),'utf8'),/Plugin.define/)
  const manifest = JSON.parse(await readFile(join(result.pluginsDir,'package.json'),'utf8'))
  assert.equal(manifest.exports['./tui'],'./tui.ts')
  const config = JSON.parse(await readFile(result.registration.path,'utf8'))
  assert.deepEqual(config.plugins,[result.pluginsDir])
  assert.equal(config.keybinds['voice-plugin.record'], defaultRecordKeybind())
  assert.match(result.binaryPath,/voice-plugin(\.exe)?$/)
 } finally { await rm(dir,{recursive:true,force:true}) }
})

test('platform defaults, user overrides and unrelated keybinds', () => {
 assert.equal(defaultRecordKeybind('darwin'), 'super+shift+r')
 assert.equal(defaultRecordKeybind('linux'), 'ctrl+alt+r')
 assert.equal(defaultRecordKeybind('win32'), 'ctrl+shift+r')
 for (const os of ['darwin','linux','win32']) {
   assert.equal(addPlugin({}, '/p', os).keybinds['voice-plugin.record'], defaultRecordKeybind(os))
   const existing = {keybinds:{'voice-plugin.record':'ctrl+k', 'app.exit':'ctrl+x'},plugins:['keep']}
   assert.deepEqual(addPlugin(existing,'/p',os).keybinds,existing.keybinds)
   assert.equal(addPlugin({keybinds:{'voice-plugin.record':false}},'/p',os).keybinds['voice-plugin.record'],false)
 }
})
