import { Service } from '@deepseek-ai/cordis'
import { readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const name = 'system-prompt'
export const inject = ['tools']

// The workspace this prompt describes is the directory containing THIS file -
// the same anchor tools.mjs uses, so prompt and tools can never disagree about
// which directory they are talking about.
const dir = path.dirname(fileURLToPath(import.meta.url))

export default class SystemPrompt extends Service {
  static inject = inject

  constructor(ctx) {
    super(ctx, 'systemPrompt')
  }

  /** Live listing of the workspace. Read fresh - files change during a turn. */
  async files() {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort()
  }

  /** Live tool list, formatted from the real definitions the tools service exposes. */
  tools() {
    return this.ctx.tools.definitions
      .map((t) => {
        const required = t.input_schema?.required ?? []
        const args = Object.keys(t.input_schema?.properties ?? {})
          .map((k) => (required.includes(k) ? k : `${k}?`))
          .join(', ')
        return `- ${t.name}(${args}): ${t.description}`
      })
      .join('\n')
  }

  /**
   * Build the system prompt. Everything is derived from live services and the
   * real filesystem at call time - nothing is baked in at load time, so a new
   * tool or a new file shows up on the next turn without a re-mount.
   */
  async assemble() {
    const files = await this.files()

    return [
      'You are a coding agent operating in a workspace directory.',
      `Workspace: ${dir}`,
      '',
      'You work by calling tools. Inspect before you edit: read a file before',
      'changing it, and use the real contents you observe rather than assuming.',
      'When the task is done, reply with a short summary and stop calling tools.',
      '',
      'Tools:',
      this.tools(),
      '',
      'Files in this directory:',
      files.length ? files.map((f) => `- ${f}`).join('\n') : '- (empty)',
    ].join('\n')
  }
}

export { SystemPrompt as apply }
