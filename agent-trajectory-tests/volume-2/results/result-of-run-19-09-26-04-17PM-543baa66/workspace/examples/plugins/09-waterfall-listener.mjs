// Example: waterfall-listener
// Teaches:  waterfall = around-middleware. The listener receives (input, next)
//           and MUST call next() unless it deliberately vetoes. Forgetting
//           next() silently swallows the downstream default.
// Expect:   Fiber ACTIVE.
// Docs:     docs/guide/part-07-events.md (section: waterfall is the most dangerous mode)
export const name = 'example-waterfall-listener'

export function apply(ctx) {
  ctx.on('example/transform', async (input, next) => {
    const result = await next()
    return result.trim()
  })
}
