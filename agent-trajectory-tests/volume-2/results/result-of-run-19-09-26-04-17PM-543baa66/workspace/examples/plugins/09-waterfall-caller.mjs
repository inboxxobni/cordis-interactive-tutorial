// Example: waterfall-caller
// Teaches:  ctx.waterfall(event, input, defaultHandler): runs listeners around
//           the default. With 09-waterfall-listener.mjs mounted the padded
//           default result is trimmed.
// Expect:   Fiber ACTIVE; logs "waterfall result: [hi]".
// Docs:     docs/guide/part-07-events.md
export const name = 'example-waterfall-caller'

export async function apply(ctx) {
  const result = await ctx.waterfall('example/transform', '  hi  ', async (input) => input)
  console.log(`[example-waterfall-caller] waterfall result: [${result}]`)
}
