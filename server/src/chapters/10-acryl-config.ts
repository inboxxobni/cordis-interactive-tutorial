/**
 * Chapter 10: Plugin configuration, the ACRYL way.
 *
 * ACRYL's real Config convention is @deepseek-ai/schemastery (e.g.
 * apps/acryl-desktop/src/updates.ts imports it as `z`, which reads like the
 * npm `zod` package but isn't - grep the whole ACRYL repo and there is no
 * `from 'zod'` import anywhere; every DSH bundle depends on schemastery).
 * Schemastery implements the same Standard Schema '~standard' interface
 * core Cordis requires (see its own README + Schema.prototype['~standard']),
 * so this is a drop-in swap for chapter 5's hand-written validator, not a
 * different mechanism underneath.
 *
 * Design principles this chapter demonstrates for real, not just states:
 *  - don't hardcode tunables: `intervalMs` below is configurable, not baked in
 *  - fail loudly on invalid config: a bad value throws a real ValidationError
 *  - works with HMR: fiber.update() re-validates and re-applies (see ch.6)
 */
import Schema from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
  intervalMs: Schema.number().min(100).max(60_000).step(1).default(5_000),
})
type Config = Schemastery.TypeT<typeof Config>

const configuredPlugin = {
  name: 'acryl-style-config',
  Config,
  apply(ctx: Context, config: Config) {
    console.log(`[acryl-style-config] greeting="${config.greeting}" intervalMs=${config.intervalMs}`)
  },
}

export const chapter: Chapter = {
  id: '10-acryl-config',
  title: 'Plugin configuration, the ACRYL way',
  async run({ ctx, emit }) {
    const validFiber = ctx.plugin(configuredPlugin, { greeting: 'hello from schemastery', intervalMs: 2_000 })
    await validFiber.await()
    emit({ type: 'config_validate', pluginId: 'acryl-style-config#valid', config: { greeting: 'hello from schemastery', intervalMs: 2000 }, valid: true })

    // Deliberately out of range - intervalMs must be <= 60000. Schemastery
    // throws a real ValidationError, which Cordis's own resolveConfig()
    // surfaces as-is.
    const invalidFiber = ctx.plugin(configuredPlugin, { greeting: 'too fast', intervalMs: 10 } as unknown as Config)
    try {
      await invalidFiber.await()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emit({ type: 'config_error', pluginId: 'acryl-style-config#invalid', message })
    }

    return async () => {
      await validFiber.dispose()
      await invalidFiber.dispose()
    }
  },
}
