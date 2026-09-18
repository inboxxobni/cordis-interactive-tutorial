import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { InternalComponent, InternalComponentMeta } from '@cordis-tutorial/shared'

/**
 * Educational source manifest. Deliberately an allowlist, not a general
 * source-file browser - the browser can inspect only these files.
 */
const MANIFEST: InternalComponentMeta[] = [
  {
    id: 'instrumentation',
    label: 'Cordis instrumentation',
    description: 'Wraps a real Cordis Context so its own internal events become typed trace events.',
    path: 'server/src/cordis-instrumentation.ts',
    events: ['plugin_register', 'fiber_state_change', 'service_provide', 'event_emit', 'effect_acquire', 'effect_dispose', 'event_listen'],
    functions: [
      { name: 'createInstrumentedContext', purpose: 'Hooks internal/plugin, internal/status, internal/service, internal/dispatch.', tooltip: 'These are the exact internal events Cordis itself dispatches - nothing here is simulated.' },
      { name: 'reportEffect', purpose: 'Reports a ctx.effect() acquire/dispose at its call site.', tooltip: 'Cordis has no generic hook for individual effects, so the chapter code reports them explicitly.' },
    ],
  },
  {
    id: 'chapter-01',
    label: 'Chapter 1: Your first plugin',
    description: 'The smallest legal Cordis plugin: a module exporting apply().',
    path: 'server/src/chapters/01-first-plugin.ts',
    events: ['plugin_register', 'fiber_state_change'],
    functions: [
      { name: 'helloPlugin.apply', purpose: 'Runs once the fiber activates.', tooltip: 'Cordis calls apply(ctx) when the fiber reaches ACTIVE - there is no separate bootstrap step.' },
    ],
  },
  {
    id: 'chapter-02',
    label: 'Chapter 2: Lifecycle and effects',
    description: 'A heartbeat timer acquired inside ctx.effect() so it is cleaned up on unload.',
    path: 'server/src/chapters/02-lifecycle-and-effects.ts',
    events: ['effect_acquire', 'effect_dispose', 'fiber_state_change'],
    functions: [
      { name: 'heartbeatPlugin.apply', purpose: 'Registers a ctx.effect() timer.', tooltip: 'Anything that outlives the apply() call must be acquired inside ctx.effect() with a disposer.' },
    ],
  },
  {
    id: 'chapter-03',
    label: 'Chapter 3: Services',
    description: 'One plugin provides a service; another requires it via inject.',
    path: 'server/src/chapters/03-services.ts',
    events: ['service_provide', 'fiber_state_change'],
    functions: [
      { name: 'greeterProvider.apply', purpose: 'Exposes a capability with ctx.provide().', tooltip: 'The service becomes visible to dependents once this fiber is ACTIVE.' },
      { name: 'greeterConsumer', purpose: 'Declares a hard dependency via inject.', tooltip: 'A plugin with an unmet inject stays PENDING - that is healthy, not broken.' },
    ],
  },
  {
    id: 'chapter-04',
    label: 'Chapter 4: Events',
    description: 'One plugin listens with ctx.on(); another broadcasts with ctx.emit().',
    path: 'server/src/chapters/04-events.ts',
    events: ['event_listen', 'event_emit'],
    functions: [
      { name: 'listenerPlugin.apply', purpose: 'Registers a ctx.on() listener.', tooltip: 'Cordis removes this listener automatically when the fiber unloads - no manual cleanup needed.' },
      { name: 'broadcasterPlugin.apply', purpose: 'Emits a custom event on an interval.', tooltip: 'ctx.emit() dispatches to every listener across the whole Context tree.' },
    ],
  },
]

export async function getInternalComponents(repoRoot: string): Promise<InternalComponent[]> {
  return Promise.all(
    MANIFEST.map(async (item) => {
      const absolute = path.resolve(repoRoot, item.path)
      const source = await fs.readFile(absolute, 'utf8')
      return { ...item, source }
    }),
  )
}
