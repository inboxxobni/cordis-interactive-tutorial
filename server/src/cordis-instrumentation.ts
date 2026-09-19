/**
 * Wraps a real @deepseek-ai/cordis root Context so every structural lifecycle
 * step it takes becomes a typed CordisTraceEvent. Nothing here is simulated:
 * these are the same internal events Cordis itself dispatches
 * (`internal/plugin`, `internal/status`, `internal/service`,
 * `internal/dispatch`) - see node_modules/@deepseek-ai/cordis/src/events.ts's
 * `InternalEvents` interface for the authoritative list.
 *
 * Two things Cordis does NOT expose a generic hook for: individual
 * `ctx.effect()` acquire/dispose calls, and `ctx.on()` registrations. For
 * those, chapters call `reportEffect`/`reportListen` explicitly at the real
 * call site below - still real (the effect genuinely runs), just observed by
 * an explicit call instead of an interception point Cordis doesn't offer.
 */
import { Context, type Fiber } from '@deepseek-ai/cordis'
import type { TraceEvent, FiberState } from '@cordis-tutorial/shared'

export type Emit = (event: TraceEvent) => void

// @deepseek-ai/cordis's FiberState is a `const enum` (fiber.ts): under
// isolatedModules (this repo's tsconfig.base.json, and tsx/esbuild in
// general) a const enum's values cannot be resolved across a package
// boundary, so `fiber.state` arrives here as a bare number. This array is
// this repo's own copy of that declaration order - keep it in sync with
// `export const enum FiberState { PENDING, LOADING, ACTIVE, FAILED,
// DISPOSED, UNLOADING }` in the installed package.
const FIBER_STATE_NAMES: FiberState[] = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

export function stateName(state: number): FiberState {
  return FIBER_STATE_NAMES[state] ?? 'PENDING'
}

// A fiber's `uid` is set to null as the FIRST step of its own disposal (see
// fiber.ts's dispose()), before the UNLOADING/DISPOSED internal/status
// events fire - so deriving an id from fiber.uid live would make a plugin's
// own teardown events report a DIFFERENT id than its earlier ACTIVE-life
// events, and a UI would see it as a different node reappearing rather than
// the same one being torn down. Cache the id once, at registration, keyed by
// fiber object identity, so every event for one fiber reports the same id.
const stableIds = new WeakMap<Fiber, string>()

/** Exported so chapter code can report effect/listener events under the exact same id fiber_state_change uses for that plugin - see reportEffect/reportListen callers. */
export function fiberId(fiber: Fiber): string {
  if (!fiber.runtime) return 'root'
  const cached = stableIds.get(fiber)
  if (cached) return cached
  const id = `${fiber.name}#${fiber.uid ?? 'disposed'}`
  stableIds.set(fiber, id)
  return id
}

export interface Instrumented {
  ctx: Context
  emit: Emit
  /** Report a ctx.effect() acquire at its real call site (see file header). */
  reportEffect: (pluginId: string, label: string, dispose: () => unknown) => () => unknown
  /** Report a ctx.on() registration at its real call site (see file header). */
  reportListen: (pluginId: string, eventName: string) => void
  /** Absolute workspace file path -> the live fiber mount_plugin created for it, so a re-mount can dispose the old one first (agent-mode only). */
  mountedPaths: Map<string, Fiber>
  /** pluginId -> the workspace-relative path that produced it, so the UI can show file provenance (agent-mode only). */
  pathByPluginId: Map<string, string>
  /**
   * Set by mount_plugin on this SAME object immediately before calling
   * ctx.plugin(), consumed by the internal/plugin handler below.
   * internal/plugin fires SYNCHRONOUSLY inside ctx.plugin(), before it
   * returns the fiber - so mount_plugin cannot learn the new pluginId in
   * time to populate pathByPluginId itself; this is the only ordering that
   * actually works, and it requires the handler to read this field off the
   * exact object mount_plugin wrote it to (not a separate closure variable).
   */
  pendingSourcePath: string | null
}

export function createInstrumentedContext(emit: Emit): Instrumented {
  const ctx = new Context()

  const instr: Instrumented = {
    ctx,
    emit,
    mountedPaths: new Map<string, Fiber>(),
    pathByPluginId: new Map<string, string>(),
    pendingSourcePath: null,
    reportEffect: (pluginId, label, dispose) => {
      emit({ type: 'effect_acquire', pluginId, label })
      return () => {
        emit({ type: 'effect_dispose', pluginId, label })
        return dispose()
      }
    },
    reportListen: (pluginId, eventName) => {
      emit({ type: 'event_listen', pluginId, eventName })
    },
  }

  ctx.on('internal/plugin', (fiber: Fiber) => {
    // Cordis dispatches this SAME event twice per fiber: once at creation,
    // and again from its own emitPluginDisposed() during teardown (fiber.ts)
    // - distinguishable only by fiber.uid already being null on the second
    // firing. Treating both as "registered" made a disposed plugin appear to
    // register fresh right as it was torn down.
    if (fiber.uid === null) {
      emit({ type: 'plugin_unmount', pluginId: fiberId(fiber) })
      return
    }
    const pluginId = fiberId(fiber)
    if (instr.pendingSourcePath) {
      instr.pathByPluginId.set(pluginId, instr.pendingSourcePath)
      instr.pendingSourcePath = null
    }
    emit({
      type: 'plugin_register',
      pluginId,
      name: fiber.name,
      hasInject: Object.keys(fiber.inject).length > 0,
      inject: Object.keys(fiber.inject),
      sourcePath: instr.pathByPluginId.get(pluginId),
    })
    emit({ type: 'fiber_state_change', pluginId, from: null, to: 'PENDING' })
  })

  ctx.on('internal/status', (fiber: Fiber, oldValue: number) => {
    emit({
      type: 'fiber_state_change',
      pluginId: fiberId(fiber),
      from: stateName(oldValue),
      to: stateName(fiber.state),
    })
  })

  // internal/service's declared `this` is the emitting Context (see the
  // Events interface in @deepseek-ai/cordis/src/events.ts), not the root ctx
  // this closure captured - a regular function is required to read it,
  // since an arrow function would silently capture the outer `this` instead
  // and always report the root fiber regardless of which plugin provided.
  ctx.on('internal/service', function (this: Context, name: string, _value: unknown) {
    emit({ type: 'service_provide', pluginId: fiberId(this.fiber), serviceName: name })
  })

  ctx.on('internal/dispatch', (_mode: unknown, name: string, args: unknown[]) => {
    emit({ type: 'event_emit', eventName: name, payload: args, listenerCount: args.length })
  })

  return instr
}
