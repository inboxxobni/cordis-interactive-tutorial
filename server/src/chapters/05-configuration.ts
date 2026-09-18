/**
 * Chapter 5: Configuration.
 *
 * A plugin declares a `Config` schema implementing the Standard Schema
 * interface (https://standardschema.dev - the same interface Cordis itself
 * validates against in fiber.ts's resolveConfig: `Config['~standard'].validate(value)`).
 * Hand-written here instead of pulling in zod, so the whole interface -
 * three fields, one method - is visible in one place.
 *
 * Mounts the same plugin twice: once with valid config (real success), once
 * with invalid config (a real ValidationError, surfaced as config_error -
 * not narrated, the actual thrown error).
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

interface GreeterConfig {
  greeting: string
}

const Config = {
  '~standard': {
    version: 1 as const,
    vendor: 'cordis-tutorial',
    validate(value: unknown) {
      if (typeof value !== 'object' || value === null || typeof (value as { greeting?: unknown }).greeting !== 'string') {
        return { issues: [{ message: 'greeting must be a string', path: ['greeting'] }] }
      }
      return { value: value as GreeterConfig }
    },
  },
}

const configuredPlugin = {
  name: 'configured-greeter',
  Config,
  apply(ctx: Context, config: GreeterConfig) {
    console.log(`[configured-greeter] config accepted: ${config.greeting}`)
  },
}

export const chapter: Chapter = {
  id: '05-configuration',
  title: 'Configuration',
  async run({ ctx, emit }) {
    const validFiber = ctx.plugin(configuredPlugin, { greeting: 'hello from valid config' })
    await validFiber.await()
    emit({ type: 'config_validate', pluginId: 'configured-greeter#valid', config: { greeting: 'hello from valid config' }, valid: true })

    // Deliberately wrong at runtime (that's the point of this half of the
    // chapter) - the cast just satisfies the static GreeterConfig type so we
    // can exercise the schema's own runtime check, not TypeScript's.
    const invalidFiber = ctx.plugin(configuredPlugin, { greeting: 42 } as unknown as GreeterConfig)
    try {
      await invalidFiber.await()
    } catch (err) {
      // This is the REAL error Cordis's own resolveConfig() throws - a
      // ValidationError built from the schema's issues, not a narrated one.
      const message = err instanceof Error ? err.message : String(err)
      emit({ type: 'config_error', pluginId: 'configured-greeter#invalid', message })
    }

    return async () => {
      await validFiber.dispose()
      await invalidFiber.dispose()
    }
  },
}
