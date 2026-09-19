// Example: tools-service
// Teaches:  a `tools` service other plugins register model-callable tools on.
//           This is the seam the coding-agent harness builds on
//           (see examples/coding-agent/).
// Expect:   Fiber ACTIVE; service `tools` resolves.
// Docs:     docs/guide/part-11-tools.md
class ToolsService {
  registry = new Map()

  register(tool) {
    this.registry.set(tool.name, tool)
  }

  async call(name, args) {
    const tool = this.registry.get(name)
    if (!tool) throw new Error(`no such tool: ${name}`)
    return tool.output.render(args, await tool.execute(args))
  }
}

export const name = 'example-tools-service'

export function apply(ctx) {
  ctx.provide('tools', new ToolsService())
}
