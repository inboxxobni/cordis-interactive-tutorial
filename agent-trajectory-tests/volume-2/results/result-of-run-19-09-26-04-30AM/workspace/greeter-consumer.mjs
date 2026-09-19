export const name = 'greeter-consumer'
export const inject = ['greeter']

export function apply(ctx) {
  const line = ctx.greeter.greet('Cordis')
  const many = ctx.greeter.greetMany(['alpha', 'beta'])

  ctx.effect(() => {
    console.log(`[greeter-consumer] ${line}`)
    console.log(`[greeter-consumer] ${many.join(' | ')}`)
    return () => console.log('[greeter-consumer] unloaded')
  })
}
