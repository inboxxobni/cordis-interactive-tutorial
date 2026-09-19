// system-prompt.mjs - the context assembler: turns the LIVE environment into
// the instructions the model starts every turn with.
//
// Provides: systemPrompt -> await ctx.systemPrompt.assemble({ task })
// Injects:  tools
//
// Nothing here is hard-coded except the working rules. The tool list comes from
// ctx.tools.definitions and the file list from a real readdir, so the prompt can
// never describe a capability or a file that no longer exists.
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'system-prompt'
export const inject = ['tools']

// Same real convention as tools.mjs / run.mjs: the workspace root is derived
// from this plugin file's own location, never the host process's cwd.
const dir = path.dirname(fileURLToPath(import.meta.url))

const MAX_FILES = 200

/** The tools service may expose definitions as an array or as a getter. */
function readDefinitions(tools) {
  const defs = typeof tools?.definitions === 'function' ? tools.definitions() : tools?.definitions
  return Array.isArray(defs) ? defs : []
}

/** Render one tool's input schema as a compact signature: (path, content?). */
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

  /** Real, current listing - read fresh on every call, never cached. */
  async listWorkspace() {
    const entries = await readdir(this.dir, { withFileTypes: true })
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
      .slice(0, MAX_FILES)
  }

  /**
   * @param {{ task?: string }} [options]
   * @returns {Promise<string>} the system prompt for this turn.
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
      `## Current task\n${task ?? '(unspecified)'}`,
    ].join('\n')
  }
}

export function apply(ctx) {
  ctx.provide('systemPrompt', new SystemPrompt(ctx, dir))
  console.log(`[system-prompt] active - systemPrompt over ${dir}`)
}
