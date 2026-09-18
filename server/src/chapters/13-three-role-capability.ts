/**
 * Chapter 13: Three-role capability design.
 *
 * Mirrors ACRYL's own real split for real: a Service Definition (the
 * abstract shape), a Service Provider (a concrete implementation extending
 * it), and a Consumer (injects and calls it) - see
 * runtime/acryl-control/src/agent/agent-control.ts (definition + provider)
 * and runtime/acryl-control/src/agent/providers/factory.ts (consumer) for
 * the real ACRYL instance this recreates at teaching scale.
 *
 * The generic Harness docs' own example is bash execution: dsh-shell
 * (definition) / dsh-bash-local (provider) / dsh-tool-bash (consumer). This
 * chapter builds the same three-file shape with a trivial capability
 * (uppercase a string) so the PATTERN is what's on screen, not incidental
 * bash-execution complexity.
 */
import { Service, type Context } from '@deepseek-ai/cordis'
import type { Chapter } from './types.js'

// --- Role 1: Service Definition ---
// Declares the Cordis service interface and its request/result types. A
// Provider and a Consumer both depend on THIS, never on each other.
interface UppercaseRequest { input: string }
interface UppercaseResult { output: string }
abstract class UppercaseService extends Service {
  abstract execute(request: UppercaseRequest): Promise<UppercaseResult>
}

// --- Role 2: Service Provider ---
// A concrete implementation. Swappable: a different provider package could
// implement UppercaseService differently (e.g. calling a remote API)
// without the definition or the consumer changing at all.
class UppercaseLocalProvider extends UppercaseService {
  constructor(ctx: Context) {
    super(ctx, 'uppercase')
  }
  async execute(request: UppercaseRequest): Promise<UppercaseResult> {
    return { output: request.input.toUpperCase() }
  }
}

// --- Role 3: Consumer ---
// Injects the service by name and exposes it as a model-callable tool -
// depends only on the shape (`ctx.uppercase.execute`), not on which
// provider package is actually mounted.
const uppercaseToolPlugin = {
  name: 'uppercase-tool',
  inject: ['uppercase'],
  async apply(ctx: Context & { uppercase: UppercaseService }) {
    const result = await ctx.uppercase.execute({ input: 'three-role capability' })
    console.log(`[uppercase-tool] called the service, got: ${result.output}`)
  },
}

export const chapter: Chapter = {
  id: '13-three-role-capability',
  title: 'Three-role capability design',
  async run({ ctx, emit }) {
    const providerFiber = ctx.plugin(UppercaseLocalProvider)
    const consumerFiber = ctx.plugin(uppercaseToolPlugin)
    await Promise.all([providerFiber.await(), consumerFiber.await()])
    emit({ type: 'log', pluginId: null, message: 'definition (UppercaseService) -> provider (UppercaseLocalProvider) -> consumer (uppercase-tool), three real packages worth of separation in one file for teaching scale' })
    return async () => {
      await consumerFiber.dispose()
      await providerFiber.dispose()
    }
  },
}
