import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareVersions, update } from './update.mjs'

test('numeric alpha version comparison', () => {
  assert.equal(compareVersions('0.1.0-alpha.8', '0.1.0-alpha.10'), 1)
  assert.equal(compareVersions('0.1.0-alpha.10', '0.1.0-alpha.9'), -1)
  assert.equal(compareVersions('0.1.0-alpha.10', '0.1.0-alpha.10'), 0)
})

test('upgrade preserves files on failed installation', async () => {
  const base = await mkdtemp(join(tmpdir(), 'va-update-test-'))
  const source = join(base, 'source'), configDir = join(base, 'config'), binDir = join(base, 'bin')
  try {
    await mkdir(join(source, 'adapters/opencode'), { recursive: true })
    await mkdir(join(configDir, 'voice-agent-plugin'), { recursive: true })
    await mkdir(binDir)
    await writeFile(join(source, 'adapters/opencode/package.json'), JSON.stringify({ version: '0.1.0-alpha.10' }))
    await writeFile(join(configDir, 'voice-agent-plugin/package.json'), JSON.stringify({ version: '0.1.0-alpha.8' }))
    await writeFile(join(configDir, 'cli.json'), '{"plugins":["old"]}\n')
    await writeFile(join(binDir, 'voice-agent'), 'old-binary')
    await assert.rejects(update({ sourceDir: source, configDir, binDir, installFn: async () => {
      await writeFile(join(binDir, 'voice-agent'), 'broken')
      await writeFile(join(configDir, 'cli.json'), '{}')
      throw new Error('simulated failure')
    } }), /restored/)
    assert.equal(await readFile(join(binDir, 'voice-agent'), 'utf8'), 'old-binary')
    assert.equal(await readFile(join(configDir, 'cli.json'), 'utf8'), '{"plugins":["old"]}\n')
    assert.equal(await versionAtInstalled(configDir), '0.1.0-alpha.8')
  } finally { await rm(base, { recursive: true, force: true }) }
})
async function versionAtInstalled(dir) { return JSON.parse(await readFile(join(dir, 'voice-agent-plugin/package.json'), 'utf8')).version }


test('release version matches bundled artifacts and triggers upgrade from alpha.22', async () => {
  const { fileURLToPath } = await import('node:url')
  const { dirname, resolve } = await import('node:path')
  const { readdir } = await import('node:fs/promises')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const manifest = JSON.parse(await readFile(join(root, 'adapters/opencode/package.json'), 'utf8'))
  const releases = await readdir(join(root, 'dist/releases'))
  assert.ok(releases.some(name => name.includes(manifest.version)), 'release binaries must match plugin version')
  assert.equal(compareVersions('0.1.0-alpha.22', manifest.version), 1)
})
