import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compareVersions, parseVersion, update, releaseRepoFromGit } from './update.mjs'

test('numeric alpha version comparison', () => {
  assert.equal(compareVersions('0.1.0-alpha.8', '0.1.0-alpha.10'), 1)
  assert.equal(compareVersions('0.1.0-alpha.10', '0.1.0-alpha.9'), -1)
  assert.equal(compareVersions('0.1.0-alpha.10', '0.1.0-alpha.10'), 0)
})

test('upgrade preserves files on failed installation', async () => {
  const base = await mkdtemp(join(tmpdir(), 'vp-update-test-'))
  const source = join(base, 'source'), configDir = join(base, 'config'), binDir = join(base, 'bin')
  try {
    await mkdir(join(source, 'adapters/opencode'), { recursive: true })
    await mkdir(join(configDir, 'voice-plugin'), { recursive: true })
    await mkdir(binDir)
    await writeFile(join(source, 'adapters/opencode/package.json'), JSON.stringify({ version: '0.1.0-alpha.10' }))
    await writeFile(join(configDir, 'voice-plugin/package.json'), JSON.stringify({ version: '0.1.0-alpha.8' }))
    await writeFile(join(configDir, 'cli.json'), '{"plugins":["old"]}\n')
    await writeFile(join(binDir, 'voice-plugin'), 'old-binary')
    await assert.rejects(update({ sourceDir: source, configDir, binDir, installFn: async () => {
      await writeFile(join(binDir, 'voice-plugin'), 'broken')
      await writeFile(join(configDir, 'cli.json'), '{}')
      throw new Error('simulated failure')
    } }), /restored/)
    assert.equal(await readFile(join(binDir, 'voice-plugin'), 'utf8'), 'old-binary')
    assert.equal(await readFile(join(configDir, 'cli.json'), 'utf8'), '{"plugins":["old"]}\n')
    assert.equal(await versionAtInstalled(configDir), '0.1.0-alpha.8')
  } finally { await rm(base, { recursive: true, force: true }) }
})
async function versionAtInstalled(dir) { return JSON.parse(await readFile(join(dir, 'voice-plugin/package.json'), 'utf8')).version }


test('manifest version parses and advances past the last shipped alpha', async () => {
  const { fileURLToPath } = await import('node:url')
  const { dirname, resolve } = await import('node:path')
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const manifest = JSON.parse(await readFile(join(root, 'adapters/opencode/package.json'), 'utf8'))
  assert.ok(parseVersion(manifest.version), 'manifest version must be a supported alpha')
  assert.equal(compareVersions('0.1.0-alpha.22', manifest.version), 1)
})

test('releaseRepoFromGit returns null outside a git checkout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vp-update-repo-'))
  try { assert.equal(releaseRepoFromGit(dir), null) }
  finally { await rm(dir, { recursive: true, force: true }) }
})
