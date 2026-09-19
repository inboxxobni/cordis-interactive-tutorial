export const name = 'greeter-reporter'
export const inject = ['greeter']

export function apply(ctx, config = {}) {
  const audience = config.audience ?? ['Ada', 'Grace']

  ctx.effect(() => {
    // ctx.greeter is guaranteed non-null here: Cordis only reaches ACTIVE
    // once every injected service is available.
    console.log(`[greeter-reporter] salutation seen: ${JSON.stringify(ctx.greeter.salutation)}`)
    console.log(`[greeter-reporter] one:  ${ctx.greeter.greet(config.host ?? 'Cordis')}`)
    ctx.greeter.greetMany(audience).forEach((line) => {
      console.log(`[greeter-reporter] many: ${line}`)
    })
    return () => console.log('[greeter-reporter] unloaded')
  })
}
