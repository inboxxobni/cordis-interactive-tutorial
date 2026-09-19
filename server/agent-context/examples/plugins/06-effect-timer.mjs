// Example: effect-timer
// Teaches:  anything that outlives apply() (a timer here) is acquired INSIDE
//           ctx.effect() and returns its disposer, so Cordis can tear it down
//           on dispose or re-mount. Never call setInterval bare in apply().
// Expect:   Fiber ACTIVE; on dispose the disposer runs ("timer cleared").
// Docs:     docs/guide/part-05-effects.md
export const name = 'example-effect-timer'

export function apply(ctx) {
  ctx.effect(() => {
    const timer = setInterval(() => console.log('[example-effect-timer] tick'), 60_000)
    return () => {
      clearInterval(timer)
      console.log('[example-effect-timer] timer cleared')
    }
  }, 'example-effect-timer: interval')
}
