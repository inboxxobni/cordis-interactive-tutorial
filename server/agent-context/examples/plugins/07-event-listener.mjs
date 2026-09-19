// Example: event-listener
// Teaches:  ctx.on(event, handler). Listeners are effects: Cordis removes them
//           automatically when this fiber unloads (no manual cleanup).
// Expect:   Fiber ACTIVE; logs "heard example/hello: world" once
//           08-event-emitter.mjs is mounted.
// Docs:     docs/guide/part-07-events.md
export const name = 'example-event-listener'

export function apply(ctx) {
  ctx.on('example/hello', (who) => {
    console.log(`[example-event-listener] heard example/hello: ${who}`)
  })
}
