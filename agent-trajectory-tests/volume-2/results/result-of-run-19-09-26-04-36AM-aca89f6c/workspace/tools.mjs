import { readFile, writeFile, readdir, stat, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'tools'

// Paths are resolved against the PLUGIN FILE, not process.cwd(), so this file
// keeps working if the workspace is copied elsewhere and run standalone
// (same real pattern run.mjs uses).
const WORKSPACE = path.dirname(fileURLToPath(import.meta.url))

const MAX_READ_CHARS = 100_000

/** Resolve a caller-supplied relative path, refusing to escape the workspace. */
function resolveInside(inputPath) {
  const rel = String(inputPath ?? '.').trim() || '.'
  const abs = path.resolve(WORKSPACE, rel)
  const within = abs === WORKSPACE || abs.startsWith(WORKSPACE + path.sep)
  if (!within) {
    throw new Error(`path escapes the workspace: ${rel} (allowed root: ${WORKSPACE})`)
  }
  return { abs, rel: path.relative(WORKSPACE, abs) || '.' }
}

function asText(value) {
  if (typeof value === 'string') return value
  return value == null ? '' : JSON.stringify(value, null, 2)
}

async function listFiles(input = {}) {
  const { abs, rel } = resolveInside(input.path)
  const info = await stat(abs).catch(() => null)
  if (!info) throw new Error(`no such path: ${rel}`)
  if (!info.isDirectory()) throw new Error(`not a directory: ${rel} (use read_file)`)
  const entries = await readdir(abs, { withFileTypes: true })
  const lines = entries
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort((a, b) => a.localeCompare(b))
  return lines.length ? lines.join('\n') : `(empty directory: ${rel})`
}

async function readFileTool(input = {}) {
  const { abs, rel } = resolveInside(input.path)
  const info = await stat(abs).catch(() => null)
  if (!info) throw new Error(`no such file: ${rel}`)
  if (info.isDirectory()) throw new Error(`not a file: ${rel} (use list_files)`)
  const text = await readFile(abs, 'utf8')
  if (text.length > MAX_READ_CHARS) {
    return `${text.slice(0, MAX_READ_CHARS)}\n\n[... truncated: ${text.length - MAX_READ_CHARS} more characters ...]`
  }
  return text
}

async function writeFileTool(input = {}) {
  const { abs, rel } = resolveInside(input.path)
  const content = asText(input.content)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, content, 'utf8')
  return `wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${rel}`
}

async function editFileTool(input = {}) {
  const { abs, rel } = resolveInside(input.path)
  const oldStr = asText(input.old_str)
  const newStr = asText(input.new_str)
  const info = await stat(abs).catch(() => null)

  if (oldStr === '') {
    await mkdir(path.dirname(abs), { recursive: true })
    await writeFile(abs, newStr, 'utf8')
    return `created ${rel} (${Buffer.byteLength(newStr, 'utf8')} bytes)`
  }
  if (!info) throw new Error(`no such file: ${rel} (pass an empty old_str to create it)`)

  const text = await readFile(abs, 'utf8')
  const first = text.indexOf(oldStr)
  if (first === -1) throw new Error(`old_str not found in ${rel}`)
  if (text.indexOf(oldStr, first + oldStr.length) !== -1) {
    throw new Error(`old_str appears more than once in ${rel} - include more surrounding context`)
  }
  const next = text.slice(0, first) + newStr + text.slice(first + oldStr.length)
  await writeFile(abs, next, 'utf8')
  return `replaced 1 occurrence in ${rel} (${Buffer.byteLength(oldStr, 'utf8')} -> ${Buffer.byteLength(newStr, 'utf8')} bytes)`
}

const definitions = [
  {
    name: 'list_files',
    description: 'List files and directories at a path relative to the workspace root. Returns names only; directories are suffixed with "/".',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to list. Defaults to "." (the workspace root).' },
      },
    },
  },
  {
    name: 'read_file',
    description: 'Read the full contents of a file by its path relative to the workspace root. Do not use on directories.',
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
    description: 'Write content to a path relative to the workspace root, creating parent directories as needed. Creates a new file or overwrites an existing one.',
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
    description: 'Replace an exact old_str with new_str in a file at a path relative to the workspace root. old_str must appear exactly once; an empty old_str creates the file.',
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

const handlers = {
  list_files: listFiles,
  read_file: readFileTool,
  write_file: writeFileTool,
  edit_file: editFileTool,
}

const tools = {
  get definitions() {
    return definitions
  },
  /** Run a tool by name. Unknown names and thrown errors are surfaced as text. */
  async execute(toolName, input) {
    const handler = handlers[toolName]
    if (!handler) {
      throw new Error(`unknown tool "${toolName}" - available: ${definitions.map((d) => d.name).join(', ')}`)
    }
    let args = input
    if (typeof args === 'string') {
      try { args = JSON.parse(args) } catch { args = { raw: args } }
    }
    return await handler(args ?? {})
  },
}

export function apply(ctx) {
  ctx.provide('tools', tools)
  ctx.logger?.info?.('[tools] providing %d tools from %s', definitions.length, WORKSPACE)
  ctx.effect(() => () => ctx.logger?.info?.('[tools] disposed'))
}

export default { name, apply }
