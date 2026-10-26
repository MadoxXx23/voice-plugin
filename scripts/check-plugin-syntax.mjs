#!/usr/bin/env node
/** Parse every plugin TS/TSX entrypoint and fail before installation/release. */
import { createRequire } from 'node:module'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'adapters/opencode/package.json'))
const files = ['index.ts', 'tui.ts', 'status.tsx']

export function checkPluginSyntax({ projectDir = root, ts } = {}) {
  if (!ts) {
    try { ts = require('typescript') }
    catch { throw new Error('TypeScript compiler is required for syntax validation. Run npm install in adapters/opencode.') }
  }
  const errors = []
  for (const name of files) {
    const file = join(projectDir, 'adapters/opencode/src', name)
    const source = ts.sys.readFile(file)
    if (source === undefined) throw new Error(`Missing plugin source: ${file}`)
    const scriptKind = name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind)
    for (const diagnostic of parsed.parseDiagnostics) {
      const position = parsed.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
      errors.push(`${file}:${position.line + 1}:${position.character + 1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`)
    }
  }
  if (errors.length) throw new Error(`Plugin syntax check failed (${errors.length} errors):\n${errors.join('\n')}`)
  return files.length
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(`Plugin syntax OK (${checkPluginSyntax()} TS/TSX files).`) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
