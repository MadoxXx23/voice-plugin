#!/usr/bin/env node
/** Explicit, offline, checksum-verified installer for release archives. No network downloads. */
import { createHash } from 'node:crypto'
import { readFile, mkdir, mkdtemp, rename, copyFile, chmod, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export function platformTarget(platform = process.platform, arch = process.arch) {
  const os = ({win32:'windows',darwin:'darwin',linux:'linux'})[platform]
  const cpu = ({x64:'amd64',arm64:'arm64'})[arch]
  if (!os || !cpu) throw new Error(`Unsupported platform: ${platform}/${arch}`)
  return {os,cpu,ext:os==='windows' ? '.zip' : '.tar.gz',exe:os==='windows'?'voice-agent.exe':'voice-agent'}
}
export function expectedChecksum(content, filename) {
  const line=content.split(/\r?\n/).find(line => line.trim().endsWith(`  ${filename}`) || line.trim().endsWith(` *${filename}`))
  if (!line) throw new Error(`No SHA256 checksum for ${filename}`)
  const hash=line.trim().split(/\s+/)[0]
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) throw new Error('Malformed SHA256 checksum')
  return hash.toLowerCase()
}
export async function install({releaseDir,version='0.1.0-alpha.9',dest=join(homedir(),'.local','bin')}) {
  if (!/^[a-zA-Z0-9.-]+$/.test(version)) throw new Error('Invalid version')
  const target=platformTarget()
  const filename=`voice-agent_${version}_${target.os}_${target.cpu}${target.ext}`
  const archive=join(resolve(releaseDir),filename)
  const content=await readFile(archive)
  const checksums=await readFile(join(resolve(releaseDir),'SHA256SUMS'),'utf8')
  const actual=createHash('sha256').update(content).digest('hex')
  if (actual!==expectedChecksum(checksums,filename)) throw new Error(`SHA256 mismatch: ${filename}`)
  const temporary=await mkdtemp(join(tmpdir(),'voice-agent-install-'))
  try {
    const listing=spawnSync('tar',target.os==='windows' ? ['-tf',archive] : ['-tzf',archive],{encoding:'utf8'})
    if(listing.status!==0) throw new Error(`Cannot inspect archive: ${listing.stderr||listing.error}`)
    const entries=listing.stdout.split(/\r?\n/).filter(Boolean).map(e=>e.replace(/^\.\//,''))
    if (entries.length===0 || entries.some(e=> ![target.exe,'README.md'].includes(e))) throw new Error('Unexpected archive entries')
    if(!entries.includes(target.exe)) throw new Error('Missing binary in archive')
    const extract=spawnSync('tar',target.os==='windows' ? ['-xf',archive,'-C',temporary,target.exe] : ['-xzf',archive,'-C',temporary,target.exe])
    if(extract.status!==0) throw new Error('Could not extract voice-agent binary')
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
  if(!option('--release-dir')) {
    console.error('Usage: node scripts/install-binary.mjs --release-dir /path/to/releases [--version VERSION] [--dest DIRECTORY]')
    process.exitCode=2
  } else {
    install({releaseDir:option('--release-dir'),version:option('--version')||undefined,dest:option('--dest')||undefined}).then(path=>console.log(`Installed: ${path}\nSet VOICE_AGENT_BIN=${path}`)).catch(e=>{console.error(e.message);process.exitCode=1})
  }
}
