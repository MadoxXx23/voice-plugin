import { spawn } from 'node:child_process'

/** OS clipboard programs; no shell interpolation or application-specific input injection. */
export function clipboardCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') return [['pbcopy', []]]
  if (platform === 'win32') return [['clip.exe', []]]
  if (platform === 'linux') {
    if (env.WAYLAND_DISPLAY) return [['wl-copy', ['--type', 'text/plain']], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]]
    return [['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']], ['wl-copy', ['--type', 'text/plain']]]
  }
  return []
}

function writeWith(command, args, text, spawnProcess, timeoutMs) {
  return new Promise((resolve, reject) => {
    let done = false
    const child = spawnProcess(command, args, { shell: false, stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true })
    const timer = setTimeout(() => finish(new Error('clipboard command timed out')), timeoutMs)
    let stderr = ''
    function finish(err) {
      if (done) return
      done = true
      clearTimeout(timer)
      if (err) { child.kill(); reject(err) }
      else resolve()
    }
    child.on('error', finish)
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-500) })
    child.stdin.on('error', finish)
    child.on('close', code => finish(code === 0 ? undefined : new Error(`${command} failed (${code}): ${stderr}`)))
    child.stdin.end(text, 'utf8')
  })
}

export async function copyToClipboard(text, { platform = process.platform, env = process.env, spawnProcess = spawn, timeoutMs = 3000 } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('No transcription to copy')
  if (Buffer.byteLength(text, 'utf8') > 64 * 1024) throw new Error('Transcription too large for automatic clipboard copy')
  const candidates = clipboardCandidates(platform, env)
  if (!candidates.length) throw new Error(`Clipboard unsupported on ${platform}`)
  let lastError
  for (const [program, args] of candidates) {
    try { await writeWith(program, args, text, spawnProcess, timeoutMs); return program }
    catch (error) { lastError = error }
  }
  throw new Error(`Clipboard unavailable: ${lastError?.message || 'no supported command'}`)
}
