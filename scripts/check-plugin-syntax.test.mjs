import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { checkPluginSyntax } from './check-plugin-syntax.mjs'
const require = createRequire(resolve('adapters/opencode/package.json'))
const ts = require('typescript')

test('all shipped OpenCode TS/TSX files parse', () => {
  assert.equal(checkPluginSyntax({ts}), 3)
})
test('rejects malformed else branch before packaging', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'voice-agent-syntax-'))
  try {
    const src = resolve('adapters/opencode/src')
    const dst = join(dir, 'adapters/opencode/src')
    await mkdir(dst, {recursive:true})
    for (const file of ['index.ts','tui.ts','status.tsx']) {
      await writeFile(join(dst,file), await readFile(join(src,file)))
    }
    await writeFile(join(dst,'tui.ts'), 'export default () => { if (true) {} else if (false) {\n')
    assert.throws(() => checkPluginSyntax({projectDir:dir, ts}), /Plugin syntax check failed/)
  } finally { await rm(dir,{recursive:true,force:true}) }
})
