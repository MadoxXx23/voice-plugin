#!/usr/bin/env node
/** Checksum-verified installer for release archives.
 * Prefers the local release directory (dist/releases); otherwise downloads the
 * archive and SHA256SUMS from a GitHub Release (releaseRepo or VOICE_PLUGIN_RELEASE_REPO). */
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, mkdtemp, rename, copyFile, chmod, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export function platformTarget(platform = process.platform, arch = process.arch) {
  const os = ({win32:'windows',darwin:'darwin',linux:'linux'})[platform]
  const cpu = ({x64:'amd64',arm64:'arm64'})[arch]
  if (!os || !cpu) throw new Error(`Unsupported platform: ${platform}/${arch}`)
  return {os,cpu,ext:os==='windows' ? '.zip' : '.tar.gz',exe:os==='windows'?'voice-plugin.exe':'voice-plugin'}
}
export function expectedChecksum(content, filename) {
  const line=content.split(/\r?\n/).find(line => line.trim().endsWith(`  ${filename}`) || line.trim().endsWith(` *${filename}`))
  if (!line) throw new Error(`No SHA256 checksum for ${filename}`)
  const hash=line.trim().split(/\s+/)[0]
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) throw new Error('Malformed SHA256 checksum')
  return hash.toLowerCase()
}
export function githubReleaseUrl(repo, version, filename) {
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) throw new Error(`Invalid release repository: ${repo} (expected OWNER/REPO)`)
  if (!/^[a-zA-Z0-9.-]+$/.test(version)) throw new Error(`Invalid version: ${version}`)
  return `https://github.com/${repo}/releases/download/v${version}/${filename}`
}
export async function install({ releaseDir, version, dest = join(homedir(), '.local', 'bin'), releaseRepo, fetchImpl = fetch } = {}) {
  if (!version) throw new Error('Version is required')
  if (!/^[a-zA-Z0-9.-]+$/.test(version)) throw new Error('Invalid version')
  const target=platformTarget()
  const filename=`voice-plugin_${version}_${target.os}_${target.cpu}${target.ext}`
  const temporary=await mkdtemp(join(tmpdir(),'voice-plugin-install-'))
  try {
    let archive, checksums
    const localDir=releaseDir ? resolve(releaseDir) : null
    const local=localDir && join(localDir,filename)
    if (local && existsSync(local)) {
      archive=local
      checksums=await readFile(join(localDir,'SHA256SUMS'),'utf8')
    } else {
      const repo=releaseRepo || process.env.VOICE_PLUGIN_RELEASE_REPO
      if (!repo) throw new Error(`No ${filename} available${localDir ? ` in ${localDir}` : ''}. Pass --release-repo OWNER/REPO or set VOICE_PLUGIN_RELEASE_REPO to download it from a GitHub Release, or run scripts/release.sh to build dist/releases locally.`)
      for (const [name,file] of [[filename,join(temporary,filename)],['SHA256SUMS',join(temporary,'SHA256SUMS')]]) {
        const response=await fetchImpl(githubReleaseUrl(repo,version,name),{signal:AbortSignal.timeout(600_000)})
        if(!response.ok) throw new Error(`Failed to download ${name} from GitHub Release v${version} (${repo}): HTTP ${response.status}`)
        await writeFile(file,Buffer.from(await response.arrayBuffer()))
      }
      archive=join(temporary,filename)
      checksums=await readFile(join(temporary,'SHA256SUMS'),'utf8')
    }
    const content=await readFile(archive)
    const actual=createHash('sha256').update(content).digest('hex')
    if (actual!==expectedChecksum(checksums,filename)) throw new Error(`SHA256 mismatch: ${filename}`)
    const listing=spawnSync('tar',target.os==='windows' ? ['-tf',archive] : ['-tzf',archive],{encoding:'utf8'})
    if(listing.status!==0) throw new Error(`Cannot inspect archive: ${listing.stderr||listing.error}`)
    const entries=listing.stdout.split(/\r?\n/).filter(Boolean).map(e=>e.replace(/^\.\//,''))
    if (entries.length===0 || entries.some(e=> ![target.exe,'README.md'].includes(e))) throw new Error('Unexpected archive entries')
    if(!entries.includes(target.exe)) throw new Error('Missing binary in archive')
    const extract=spawnSync('tar',target.os==='windows' ? ['-xf',archive,'-C',temporary,target.exe] : ['-xzf',archive,'-C',temporary,target.exe])
    if(extract.status!==0) throw new Error('Could not extract voice-plugin binary')
    await mkdir(dest,{recursive:true})
    const tempOutput=join(dest,`.${target.exe}.${process.pid}.tmp`)
    await copyFile(join(temporary,target.exe),tempOutput)
    if(target.os!=='windows') await chmod(tempOutput,0o755)
    await rename(tempOutput,join(dest,target.exe))
    return join(dest,target.exe)
  } finally { await rm(temporary,{recursive:true,force:true}) }
}
if (process.argv[1] && import.meta.url===new URL(`file://${resolve(process.argv[1])}`).href) {
  const args=process.argv.slice(2)
  const option=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:undefined}
  if(!option('--version')) {
    console.error('Usage: node scripts/install-binary.mjs --version VERSION [--release-dir /path/to/releases] [--release-repo OWNER/REPO] [--dest DIRECTORY]')
    process.exitCode=2
  } else {
    install({releaseDir:option('--release-dir'),version:option('--version'),dest:option('--dest')||undefined,releaseRepo:option('--release-repo')}).then(path=>console.log(`Installed: ${path}\nSet VOICE_PLUGIN_BIN=${path}`)).catch(e=>{console.error(e.message);process.exitCode=1})
  }
}
