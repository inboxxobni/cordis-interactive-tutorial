import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'system-prompt'
export const inject = ['tools']

// Same real convention as tools.mjs/run.mjs: everything is resolved from the
// plugin file's own location, never the host process's cwd.
const dir = path.dirname(fileURLToPath(import.meta.url))

const MAX_FILES = 200

/** Accept either a real array or a callable accessor - the tools service
 *  owns that choice, this just reads it. */
function readDefinitions(tools) {
  const defs = typeof tools?.definitions === 'function' ? tools.definitions() : tools?.definitions
  return Array.isArray(defs) ? defs : []
}

function describeParams(schema) {
  const props = schema?.properties
  if (!props || typeof props !== 'object') return ''
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  const parts = Object.entries(props).map(([key, value]) => {
    const type = value?.type ?? 'any'
    return `${key}${required.has(key) ? '' : '?'}: ${type}`
  })
  return parts.length ? `(${parts.join(', ')})` : ''
}

export class SystemPrompt {
  constructor(ctx, root) {
    this.ctx = ctx
    this.dir = root
  }

  /** Real, current listing of the workspace - read fresh on every call, so
   *  the prompt can never describe a directory state that no longer exists. */
  async listWorkspace() {
    const entries = await readdir(this.dir, { withFileTypes: true })
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .slice(0, MAX_FILES)
  }

  /**
   * Build the system prompt string. `task` is optional context; the tools
   * section and the workspace listing are always derived from the live
   * services and the live filesystem, never hard-coded.
   */
  async assemble({ task } = {}) {
    const definitions = readDefinitions(this.ctx?.tools)
    const files = await this.listWorkspace()

    const toolLines = definitions.length
      ? definitions
          .map((d) => {
            const head = `- ${d.name}${describeParams(d.input_schema)}`
            return d.description ? `${head}\n    ${d.description}` : head
          })
          .join('\n')
      : '(no tools are currently available)'

    return [
      'You are a coding agent working in a real workspace directory on disk.',
      '',
      '## Working rules',
      `- All paths are relative to the workspace root (${this.dir}).`,
      '- Use the tools below to inspect and change the workspace; do not guess at',
      '  file contents or names. Read before you write.',
      '- After changing something, verify the change really happened.',
      '- Keep the final answer short: what you did, and what you verified.',
      '',
      '## Available tools',
      toolLines,
      '',
      '## Workspace files right now',
      ...files.map((f) => `- ${f}`),
      '',
      task ? `## Current task\n${task}` : '## Current task\n(unspecified)',
    ].join('\n')
  }
}

export function apply(ctx) {
  const systemPrompt = new SystemPrompt(ctx, dir)
  ctx.provide('systemPrompt', systemPrompt)

  console.log(`[system-prompt] active - provided systemPrompt over ${dir}`)
}
