export const name = 'greeter'

/**
 * Provides a `greeter` service on the Context.
 * Another plugin can require it with: export const inject = ['greeter']
 */
export function apply(ctx, config = {}) {
  const salutation = config.salutation ?? 'Hello'

  const service = {
    salutation,
    greet(name = 'world') {
      return `${salutation}, ${name}!`
    },
    greetMany(names = []) {
      return names.map((n) => service.greet(n))
    },
  }

  ctx.provide('greeter', service)

  ctx.effect(() => {
    console.log(`[greeter] service provided (salutation: ${JSON.stringify(salutation)})`)
    return () => console.log('[greeter] service withdrawn')
  })
}
