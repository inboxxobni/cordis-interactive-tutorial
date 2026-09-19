/**
 * Tool registry. A tool is name + description + input_schema + function.
 */
import type { ToolDefinition } from '@cordis-tutorial/shared'
import type { Workspace } from '../workspace.js'
import type { Emit } from '../trace.js'
import type { Instrumented } from '../cordis-instrumentation.js'
import { listFiles, readFile, writeFile, editFile } from './files.js'
import { mountPlugin } from './mount-plugin.js'
import { cordisInspectList, cordisInspectQuery } from './inspect.js'
import { runWorkspaceAgentTurn } from './run-workspace-agent.js'

export interface ToolContext {
  workspace: Workspace
  emit: Emit
  instr: Instrumented
}

export interface ToolRunResult {
  result: string
  isError: boolean
}

export interface Tool {
  def: ToolDefinition
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolRunResult>
}

export function buildTools(): Tool[] {
  return [listFiles, readFile, writeFile, editFile, mountPlugin, cordisInspectList, cordisInspectQuery, runWorkspaceAgentTurn]
}

export function toolDefinitions(tools: Tool[]): ToolDefinition[] {
  return tools.map((t) => t.def)
}

export async function executeTool(tool: Tool, input: Record<string, unknown>, ctx: ToolContext): Promise<ToolRunResult> {
  try {
    return await tool.run(input, ctx)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { result: `Error: ${message}`, isError: true }
  }
}
