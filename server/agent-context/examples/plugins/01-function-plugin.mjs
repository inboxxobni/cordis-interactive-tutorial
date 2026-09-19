// Example: function-plugin
// Teaches:  the smallest plugin. Exports `name` and `apply(ctx, config)`.
// Expect:   Fiber ACTIVE when mounted alone.
// Docs:     docs/guide/part-04-plugins-and-fibers.md
export const name = 'example-function-plugin'

export function apply(ctx, config = {}) {
  console.log(`[example-function-plugin] active, config: ${JSON.stringify(config)}`)
}
