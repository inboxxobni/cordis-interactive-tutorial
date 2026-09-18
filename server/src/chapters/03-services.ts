/**
 * Chapter 3: Services.
 *
 * One plugin exposes a capability on ctx with ctx.provide(); another
 * declares it as a hard requirement with `export const inject = [...]`.
 * Cordis holds the consumer PENDING until the provider is ACTIVE, then
 * activates it - watch the consumer's fiber_state_change events for that.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

const greeterProvider = {
  name: 'greeter-provider',
  apply(ctx: Context) {
    ctx.provide('greeter', {
      greet: (who: string) => `Hello, ${who}!`,
    })
  },
}

const greeterConsumer = {
  name: 'greeter-consumer',
  inject: ['greeter'],
  apply(ctx: Context) {
    const greeting = (ctx as unknown as { greeter: { greet: (who: string) => string } }).greeter.greet('Cordis')
    ctx.logger?.info?.(greeting)
  },
}

export const chapter: Chapter = {
  id: '03-services',
  title: 'Services',
  async run({ ctx }) {
    // Mount the consumer first on purpose: load order in the source is not
    // load order in Cordis. The consumer stays PENDING until the provider
    // (mounted second, below) goes ACTIVE.
    const consumerFiber = ctx.plugin(greeterConsumer)
    const providerFiber = ctx.plugin(greeterProvider)
    await Promise.all([consumerFiber, providerFiber])
    return async () => {
      await consumerFiber.dispose()
      await providerFiber.dispose()
    }
  },
}
