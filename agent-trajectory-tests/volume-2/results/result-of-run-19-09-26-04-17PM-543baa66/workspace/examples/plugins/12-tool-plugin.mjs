// Example: tool-plugin
// Teaches:  a tool is a plugin that injects `tools` and registers a definition:
//           name, description, parameters, output (schema + render), execute.
// Expect:   mounted alone: PENDING (no `tools` yet). After 11-tools-service.mjs: ACTIVE
//           and logs "registered tool: greet".
// Docs:     docs/guide/part-11-tools.md
export const name = 'example-tool-plugin'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: { name: { type: 'string', required: true, description: 'The name to greet' } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute(args) {
      return `Hello, ${args.name}!`
    },
  })
  console.log('[example-tool-plugin] registered tool: greet')
}
