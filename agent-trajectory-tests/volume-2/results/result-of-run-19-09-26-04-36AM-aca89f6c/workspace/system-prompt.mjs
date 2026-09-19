import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'system-prompt'

// Real dependency: the tool list in the prompt comes from the tools service.
export const inject = ['tools']

const DIR = path.dirname(fileURLToPath(import.meta.url))

const BASE_PROMPT = [
  'You are a coding agent working inside a sandboxed workspace directory.',
  'You act by calling tools - never claim to have done something you did not actually do.',
  'Use the tool results you receive as ground truth, and iterate until the task is done.',
].join('\n')

/** Real, current listing of this directory (directories suffixed with "/"). */
export async function listWorkspace(dir = DIR) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort((a, b) => a.localeCompare(b))
}

function renderTool(tool) {
  const required = tool?.input_schema?.required
  const props = tool?.input_schema?.properties ?? {}
  const args = Object.entries(props)
    .map(([key, schema]) => `      ${key}${required?.includes(key) ? ' (required)' : ''}: ${schema?.description ?? schema?.type ?? 'any'}`)
    .join('\n')
  return [
    `  - ${tool?.name ?? 'unnamed'}: ${tool?.description ?? ''}`,
    args ? `    input:\n${args}` : null,
  ].filter(Boolean).join('\n')
}

const systemPrompt = {
  name: 'systemPrompt',
  workspace: DIR,

  /** The real tool list, read live from ctx.tools - never a hardcoded copy. */
  toolLines() {
    const definitions = this.ctx?.tools?.definitions
    return Array.isArray(definitions) ? definitions : []
  },

  /**
   * Build the full system prompt: base behaviour, the tools actually mounted
   * right now, and the real contents of this workspace directory.
   */
  async assemble(extra = {}) {
    const toolsList = this.toolLines()
    const files = await listWorkspace(this.workspace)
    const sections = [
      BASE_PROMPT,
      [
        '# Workspace',
        `All paths are relative to: ${this.workspace}`,
        'Files currently present:',
        files.length ? files.map((f) => `  ${f}`).join('\n') : '  (empty)',
      ].join('\n'),
      [
        '# Tools',
        toolsList.length
          ? toolsList.map(renderTool).join('\n')
          : '  (no tools are mounted right now)',
      ].join('\n'),
      '# Rules',
      [
        '1. Read a file before editing it.',
        '2. Prefer edit_file for small changes and write_file for new or rewritten files.',
        '3. If a tool returns an error, read it and adjust the call - do not repeat it unchanged.',
        '4. Stop and report the final answer once the task is complete.',
      ].join('\n'),
    ]
    if (extra.instructions) sections.push(String(extra.instructions))
    return sections.join('\n\n')
  },

  /** System messages array, ready to prepend to a message list. */
  async message(extra) {
    return { role: 'system', content: await this.assemble(extra) }
  },
}

export function apply(ctx) {
  systemPrompt.ctx = ctx
  ctx.provide('systemPrompt', systemPrompt)

  // Keep the prompt honest: log when the tool set the prompt is built from changes.
  ctx.effect(() => ctx.on('internal/service', (name) => {
    if (name === 'tools') ctx.logger?.info?.('[system-prompt] tools changed; prompt will be rebuilt on next assemble()')
  }))

  ctx.logger?.info?.('[system-prompt] providing systemPrompt for workspace %s', DIR)
  ctx.effect(() => () => ctx.logger?.info?.('[system-prompt] disposed'))
}

export default { name, inject, apply }
