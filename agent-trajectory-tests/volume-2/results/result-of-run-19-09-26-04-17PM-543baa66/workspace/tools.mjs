// tools.mjs - the tool registry: what turns a model reply into action on disk.
//
// Provides: tools -> ctx.tools.definitions / ctx.tools.execute(name, input)
// Injects:  nothing (ACTIVE the moment it is mounted)
//
// Four real tools (node:fs/promises) operating on THIS directory. The root is
// derived from this file's own URL, exactly like run.mjs does, so the tools
// keep working when the workspace is copied elsewhere or the host process has
// a different cwd.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'tools'

const dir = path.dirname(fileURLToPath(import.meta.url))

/** Guard: no file it can reach may sit outside the workspace root. */
const safeJoin = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error('path must be a non-empty string')
  }
  const abs = path.resolve(dir, raw)
  const rel = path.relative(dir, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`path escapes the workspace: ${raw}`)
  }
  return abs
}

// --- tool implementations ------------------------------------------------

async function toolListFiles({ path: p = '.' } = {}) {
  const entries = await readdir(safeJoin(p), { withFileTypes: true })
  if (!entries.length) return '(empty directory)'
  return entries
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort()
    .join('\n')
}

async function toolReadFile({ path: p } = {}) {
  return await readFile(safeJoin(p), 'utf8')
}

async function toolWriteFile({ path: p, content } = {}) {
  if (typeof content !== 'string') throw new Error('content must be a string')
  const abs = safeJoin(p)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, content, 'utf8')
  return `wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path.relative(dir, abs)}`
}

/** Exact-string edit: `old_str` must appear exactly once (empty = create). */
async function toolEditFile({ path: p, old_str, new_str } = {}) {
  if (typeof old_str !== 'string') throw new Error('old_str must be a string')
  if (typeof new_str !== 'string') throw new Error('new_str must be a string')

  const abs = safeJoin(p)

  if (old_str === '') {
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, new_str, 'utf8')
    return `created ${path.relative(dir, abs)}`
  }

  const current = await readFile(abs, 'utf8')
  const at = current.indexOf(old_str)
  if (at === -1) throw new Error('old_str not found in file')
  if (current.indexOf(old_str, at + old_str.length) !== -1) {
    throw new Error('old_str appears more than once; make it unique')
  }

  const next = current.slice(0, at) + new_str + current.slice(at + old_str.length)
  await writeFile(abs, next, 'utf8')
  return `edited ${path.relative(dir, abs)}`
}

const handlers = {
  list_files: toolListFiles,
  read_file: toolReadFile,
  write_file: toolWriteFile,
  edit_file: toolEditFile,
}

// --- what the model is allowed to call -----------------------------------

const definitions = [
  {
    name: 'list_files',
    description: 'List files and directories at a path in the workspace.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative directory path. Defaults to ".".' },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read a file in the workspace and return its full contents.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or overwrite a file with the given content, creating parent directories as needed.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Replace an exact string in a file. old_str must appear exactly once; an empty old_str creates the file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path.' },
        old_str: { type: 'string', description: 'Exact text to replace.' },
        new_str: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
]

export class Tools {
  constructor(root) {
    this.root = root
    this.definitions = definitions
  }

  async execute(name, input) {
    const handler = handlers[name]
    if (!handler) throw new Error(`unknown tool: ${name}`)
    return await handler(input ?? {})
  }
}

export function apply(ctx) {
  ctx.provide('tools', new Tools(dir))
  console.log(`[tools] active - tools over ${dir} (${definitions.length} tools)`)
}
