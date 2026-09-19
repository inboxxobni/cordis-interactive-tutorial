/**
 * The `tools` service - Volume 2, chapter 18. Real minimal toolset (4 tools,
 * matching DeepSeek Harness's own smallest practical set - read/write/edit +
 * one more, here list_files instead of bash, since this sandbox already has
 * no shell access story outside the Terminal panel): list_files, read_file,
 * write_file, edit_file. Reuses the EXACT same Tool objects the tutorial's
 * own outer meta-agent already uses (server/src/tools/files.ts) - same real
 * workspace, same real file operations, not a second implementation.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ToolDefinition } from '@cordis-tutorial/shared'
import type { Instrumented } from '../../../cordis-instrumentation.js'
import { listFiles, readFile, writeFile, editFile } from '../../../tools/files.js'
import type { Tool, ToolRunResult } from '../../../tools/registry.js'

export interface ToolsService {
  definitions: ToolDefinition[]
  execute(name: string, input: Record<string, unknown>): Promise<ToolRunResult>
}

const TOOLS: Tool[] = [listFiles, readFile, writeFile, editFile]

export function mountTools(ctx: Context, instr: Instrumented) {
  return ctx.plugin({
    name: 'agent-harness-tools',
    apply(pluginCtx: Context) {
      const service: ToolsService = {
        definitions: TOOLS.map((t) => t.def),
        async execute(name, input) {
          const tool = TOOLS.find((t) => t.def.name === name)
          if (!tool) return { result: `Error: unknown tool "${name}"`, isError: true }
          return tool.run(input, { workspace: instr.workspace, emit: instr.emit, instr })
        },
      }
      pluginCtx.provide('tools', service)
    },
  })
}
