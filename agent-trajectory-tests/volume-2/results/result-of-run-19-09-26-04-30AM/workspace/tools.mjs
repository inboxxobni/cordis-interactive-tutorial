import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'tools'

// Resolve relative to the PLUGIN FILE, not the server's cwd - so this keeps
// working if the workspace is copied elsewhere and run standalone.
const dir = path.dirname(fileURLToPath(import.meta.url))

function resolve(rel) {
  if (typeof rel !== 'string' || rel.length === 0) {
    throw new Error('path must be a non-empty string')
  }
  const abs = path.resolve(dir, rel)
  if (abs !== dir && !abs.startsWith(dir + path.sep)) {
    throw new Error(`path escapes workspace: ${rel}`)
  }
  return abs
}

const definitions = [
  {
    name: 'list_files',
    description:
      'List files and directories at a relative path (default "."). Returns names only; directories get a trailing slash.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to list. Defaults to the workspace root.' },
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
        path: { type: 'string', description: 'Relative path to the file.' },
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
        path: { type: 'string', description: 'Relative path to the file.' },
        old_str: { type: 'string', description: 'Exact text to find. Empty to create the file.' },
        new_str: { type: 'string', description: 'Replacement text.' },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
]

async function execute(name, input = {}) {
  switch (name) {
    case 'list_files': {
      const entries = await readdir(resolve(input.path ?? '.'), { withFileTypes: true })
      return entries
        .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
        .sort()
        .join('\n')
    }

    case 'read_file': {
      const target = resolve(input.path)
      const info = await stat(target)
      if (info.isDirectory()) throw new Error(`not a file: ${input.path}`)
      return await readFile(target, 'utf8')
    }

    case 'write_file': {
      const target = resolve(input.path)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, input.content ?? '', 'utf8')
      return `wrote ${input.path} (${Buffer.byteLength(input.content ?? '', 'utf8')} bytes)`
    }

    case 'edit_file': {
      const target = resolve(input.path)

      if (input.old_str === '') {
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, input.new_str, 'utf8')
        return `created ${input.path}`
      }

      const text = await readFile(target, 'utf8')
      const first = text.indexOf(input.old_str)
      if (first === -1) throw new Error(`old_str not found in ${input.path}`)
      if (text.indexOf(input.old_str, first + input.old_str.length) !== -1) {
        throw new Error(`old_str appears more than once in ${input.path}`)
      }

      await writeFile(target, text.slice(0, first) + input.new_str + text.slice(first + input.old_str.length), 'utf8')
      return `edited ${input.path}`
    }

    default:
      throw new Error(`unknown tool: ${name}`)
  }
}

const service = { definitions, execute, dir }

export function apply(ctx) {
  ctx.provide('tools', service)
}
