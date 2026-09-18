/**
 * Chapter 9: Build a tool.
 *
 * ACRYL's real tools are registered with `defineTool()` against an injected
 * `tools` service - see runtime/acryl-harness-runtime/src/plugin-acryl-workspace-status.ts
 * for the real thing. This chapter re-implements that exact contract
 * (name, description, parameters, output.schema/render, execute) minimally,
 * so the sandbox stays free of the full @deepseek-ai/dsh-tools dependency
 * tree while teaching the real shape, not a simplified one.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

interface ToolDef<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  name: string
  description: string
  parameters: Record<string, { type: string; required?: boolean; description?: string }>
  output: { schema: { type: string }; render: (args: TArgs, value: unknown) => unknown }
  execute(args: TArgs): Promise<unknown> | unknown
}

function defineTool<TArgs extends Record<string, unknown>>(def: ToolDef<TArgs>): ToolDef<TArgs> {
  return def
}

class ToolsService {
  private registry = new Map<string, ToolDef<never>>()
  register(tool: ToolDef<never>) {
    this.registry.set(tool.name, tool)
  }
  async call(name: string, args: Record<string, unknown>) {
    const tool = this.registry.get(name)
    if (!tool) throw new Error(`no such tool: ${name}`)
    const value = await tool.execute(args as never)
    return tool.output.render(args as never, value)
  }
}

const toolsServicePlugin = {
  name: 'tools-service',
  apply(ctx: Context) {
    ctx.provide('tools', new ToolsService())
  },
}

const greetToolPlugin = {
  name: 'greet-tool',
  inject: ['tools'],
  apply(ctx: Context & { tools: ToolsService }) {
    ctx.tools.register(
      defineTool({
        name: 'greet',
        description: 'Greet someone by name.',
        parameters: { name: { type: 'string', required: true, description: 'The name to greet' } },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        async execute(args: { name: string }) {
          return `Hello, ${args.name}!`
        },
      }),
    )
  },
}

export const chapter: Chapter = {
  id: '09-build-a-tool',
  title: 'Build a tool',
  async run({ ctx, emit }) {
    const serviceFiber = ctx.plugin(toolsServicePlugin)
    const toolFiber = ctx.plugin(greetToolPlugin)
    await Promise.all([serviceFiber.await(), toolFiber.await()])

    // Prove it's actually callable, the same way a model's tool_use would be.
    const tools = ctx.get('tools') as ToolsService | undefined
    if (tools) {
      const result = await tools.call('greet', { name: 'Ada' })
      emit({ type: 'log', pluginId: 'greet-tool#1', message: `called greet tool, got: ${JSON.stringify(result)}` })
    }

    return async () => {
      await toolFiber.dispose()
      await serviceFiber.dispose()
    }
  },
}
