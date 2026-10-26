import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {platformTarget,expectedChecksum,githubReleaseUrl,install} from '../scripts/install-binary.mjs'
test('platform mapping',()=>{
  assert.deepEqual(platformTarget('darwin','arm64'),{os:'darwin',cpu:'arm64',ext:'.tar.gz',exe:'voice-plugin'})
  assert.deepEqual(platformTarget('win32','x64'),{os:'windows',cpu:'amd64',ext:'.zip',exe:'voice-plugin.exe'})
  assert.throws(()=>platformTarget('freebsd','x64'),/Unsupported/)
})
test('checksum parsing',()=>{
  const hash='a'.repeat(64)
  assert.equal(expectedChecksum(`${hash}  example.zip\n`,'example.zip'),hash)
  assert.throws(()=>expectedChecksum('', 'example.zip'), /No SHA256/)
})
test('github release URL',()=>{
  assert.equal(
    githubReleaseUrl('owner/repo','0.1.0-alpha.23','voice-plugin_0.1.0-alpha.23_darwin_arm64.tar.gz'),
    'https://github.com/owner/repo/releases/download/v0.1.0-alpha.23/voice-plugin_0.1.0-alpha.23_darwin_arm64.tar.gz')
  assert.throws(()=>githubReleaseUrl('owner/repo/name','1','x'),/Invalid release repository/)
  assert.throws(()=>githubReleaseUrl('owner/repo','bad version','x'),/Invalid version/)
})
async function fakeRelease(work, version, { wrongChecksum = false } = {}) {
  const target = platformTarget()
  const filename = `voice-plugin_${version}_${target.os}_${target.cpu}${target.ext}`
  const stage = join(work, 'stage')
  await mkdir(stage, { recursive: true })
  await writeFile(join(stage, target.exe), '#!/bin/sh\necho stub\n')
  await writeFile(join(stage, 'README.md'), 'release\n')
  spawnSync('tar', ['-czf', join(work, 'archive' + target.ext), '-C', stage, target.exe, 'README.md'], { stdio: 'inherit' })
  const content = await readFile(join(work, 'archive' + target.ext))
  const hash = createHash('sha256').update(content).digest('hex')
  const sums = `${wrongChecksum ? 'f'.repeat(64) : hash}  ${filename}`
  const urls = []
  const fetchImpl = async url => {
    urls.push(url)
    if (!url.startsWith(`https://github.com/owner/repo/releases/download/v${version}/`)) throw new Error(`unexpected URL: ${url}`)
    if (url.endsWith(filename)) return { ok: true, arrayBuffer: async () => content }
    if (url.endsWith('SHA256SUMS')) return { ok: true, arrayBuffer: async () => sums }
    throw new Error(`unexpected URL: ${url}`)
  }
  return { target, filename, fetchImpl, urls }
}
test('install downloads archive from GitHub Release and verifies checksum', async () => {
  const work = await mkdtemp(join(tmpdir(), 'vp-release-test-'))
  try {
    const { fetchImpl, urls } = await fakeRelease(work, '0.1.0-alpha.23')
    const dest = join(work, 'bin')
    const path = await install({ version: '0.1.0-alpha.23', dest, releaseRepo: 'owner/repo', fetchImpl })
    assert.equal(path, join(dest, platformTarget().exe))
    assert.match(await readFile(path, 'utf8'), /stub/)
    assert.equal(urls.length, 2, 'downloads archive and SHA256SUMS')
  } finally { await rm(work, { recursive: true, force: true }) }
})
test('install rejects a corrupted GitHub Release archive', async () => {
  const work = await mkdtemp(join(tmpdir(), 'vp-release-test-'))
  try {
    const { fetchImpl } = await fakeRelease(work, '0.1.0-alpha.23', { wrongChecksum: true })
    await assert.rejects(install({ version: '0.1.0-alpha.23', dest: join(work, 'bin'), releaseRepo: 'owner/repo', fetchImpl }), /SHA256 mismatch/)
  } finally { await rm(work, { recursive: true, force: true }) }
})
test('install without local archive and without release repo fails clearly', async () => {
  const saved = process.env.VOICE_PLUGIN_RELEASE_REPO
  delete process.env.VOICE_PLUGIN_RELEASE_REPO
  try {
    await assert.rejects(install({
      version: '0.1.0-alpha.23',
      dest: join(tmpdir(), 'vp-none'),
      releaseRepo: undefined,
      fetchImpl: async () => { throw new Error('must not fetch') },
    }), /release-repo|VOICE_PLUGIN_RELEASE_REPO/)
  } finally {
    if (saved === undefined) delete process.env.VOICE_PLUGIN_RELEASE_REPO
    else process.env.VOICE_PLUGIN_RELEASE_REPO = saved
  }
})
