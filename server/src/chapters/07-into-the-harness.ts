/**
 * Chapter 7: Into the harness.
 *
 * A real DeepSeek Harness Tool is "a consumer of ctx.tools, not a Cordis
 * primitive" (this repo's own ACRYL guide, and the Cordis mini-design
 * protocol it documents). This chapter doesn't pull in the full harness -
 * instead it builds the minimal seam: a `tools` service any plugin can
 * `inject`, and a second plugin that registers a callable tool against it.
 * That registration shape is exactly what a real Harness tool plugin does;
 * only the registry backing `ctx.tools` differs.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

interface ToolDef {
  name: string
  run: (input: Record<string, unknown>) => unknown
}

class ToolRegistry {
  private tools = new Map<string, ToolDef>()
  define(tool: ToolDef) {
    this.tools.set(tool.name, tool)
  }
  call(name: string, input: Record<string, unknown>) {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`no such tool: ${name}`)
    return tool.run(input)
  }
}

const toolsServicePlugin = {
  name: 'tools-service',
  apply(ctx: Context) {
    ctx.provide('tools', new ToolRegistry())
  },
}

const echoToolPlugin = {
  name: 'echo-tool',
  inject: ['tools'],
  apply(ctx: Context & { tools: ToolRegistry }) {
    ctx.tools.define({
      name: 'echo',
      run: (input) => `echo: ${JSON.stringify(input)}`,
    })
    // Prove it's actually callable, the same way a model's tool_use would be.
    const result = ctx.tools.call('echo', { hello: 'harness' })
    console.log(`[echo-tool] called echo tool, got: ${result}`)
  },
}

export const chapter: Chapter = {
  id: '07-into-the-harness',
  title: 'Into the harness',
  async run({ ctx }) {
    const serviceFiber = ctx.plugin(toolsServicePlugin)
    const toolFiber = ctx.plugin(echoToolPlugin)
    await Promise.all([serviceFiber.await(), toolFiber.await()])
    return async () => {
      await toolFiber.dispose()
      await serviceFiber.dispose()
    }
  },
}
