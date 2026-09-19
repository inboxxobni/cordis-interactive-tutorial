// Example: event-emitter
// Teaches:  ctx.emit(event, ...args): synchronous broadcast; return values are
//           ignored. Mount 07-event-listener.mjs FIRST or this emit is heard by nobody.
// Expect:   Fiber ACTIVE.
// Docs:     docs/guide/part-07-events.md (emit vs parallel/serial/bail/waterfall)
export const name = 'example-event-emitter'

export function apply(ctx) {
  ctx.emit('example/hello', 'world')
}
