import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'tools'

// Resolve everything relative to THIS plugin file, never the server's cwd -
// same real pattern run.mjs uses, so the workspace stays portable.
const dir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolve a caller-supplied relative path against this workspace directory
 * and refuse to escape it.
 */
function resolveIn(input, key = 'path') {
  const raw = input?.[key]
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`"${key}" must be a non-empty string`)
  }
  const abs = path.resolve(dir, raw)
  const rel = path.relative(dir, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`path escapes the workspace: ${raw}`)
  }
  return abs
}

export const definitions = [
  {
    name: 'list_files',
    description:
      'List files and directories at a relative path (default "."). Returns names only.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to list. Defaults to the workspace root.',
        },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read the full contents of a file by relative path. Do not use on directories.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to the file.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description:
      'Write content to a relative path, creating parent directories as needed. Creates a new file or overwrites an existing one.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to write.' },
        content: { type: 'string', description: 'Full file content.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Replace an exact old_str with new_str in a file. old_str must appear exactly once; empty old_str creates the file.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to edit.' },
        old_str: { type: 'string', description: 'Exact text to find. Empty to create the file.' },
        new_str: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
]

async function listFiles(input) {
  const abs = resolveIn(input ?? {})
  const entries = await readdir(abs, { withFileTypes: true })
  const names = entries
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort()
  return names.length ? names.join('\n') : '(empty directory)'
}

async function readFileTool(input) {
  const abs = resolveIn(input)
  return await readFile(abs, 'utf8')
}

async function writeFileTool(input) {
  const abs = resolveIn(input)
  const content = input?.content
  if (typeof content !== 'string') throw new Error('"content" must be a string')
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, content, 'utf8')
  return `wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path.relative(dir, abs)}`
}

async function editFileTool(input) {
  const abs = resolveIn(input)
  const oldStr = input?.old_str
  const newStr = input?.new_str
  if (typeof oldStr !== 'string') throw new Error('"old_str" must be a string')
  if (typeof newStr !== 'string') throw new Error('"new_str" must be a string')

  if (oldStr === '') {
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, newStr, 'utf8')
    return `created ${path.relative(dir, abs)}`
  }

  const current = await readFile(abs, 'utf8')
  const first = current.indexOf(oldStr)
  if (first === -1) throw new Error('old_str not found in file')
  if (current.indexOf(oldStr, first + oldStr.length) !== -1) {
    throw new Error('old_str appears more than once; make it unique')
  }

  await writeFile(abs, current.slice(0, first) + newStr + current.slice(first + oldStr.length), 'utf8')
  return `edited ${path.relative(dir, abs)}`
}

const handlers = {
  list_files: listFiles,
  read_file: readFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
}

export class Tools {
  constructor(root) {
    this.dir = root
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
  console.log('[tools] active - provided tools (list_files, read_file, write_file, edit_file)')
}
