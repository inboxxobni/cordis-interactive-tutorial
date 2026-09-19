<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4367-4437 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XXVI — Compact master reference

## 142. Cordis primitive cheat sheet

| Primitive | Meaning | Most common use |
|---|---|---|
| `Context` | scoped runtime environment | service lookup + registrations |
| `ctx.plugin()` | mount child lifecycle | compose behavior from code |
| `ctx.inject()` | gated child behavior | conditional behavior on services |
| `Fiber` | mounted plugin instance | lifecycle state/cleanup/debugging |
| `Service` | named capability | provider abstraction |
| `inject` | required service set | dependency-driven activation |
| `ctx.get()` | optional service lookup | optional enhancement |
| `ctx.effect()` | own custom side effect | timer/socket/watcher cleanup |
| `ctx.on()` | lifecycle-owned listener | event observation/interception |
| `emit` | sync broadcast | notification |
| `parallel` | await all listeners | fan-out completion |
| `serial` | ordered async bail | decision chain |
| `bail` | ordered sync bail | synchronous decision |
| `waterfall` | around-middleware | policy/interception |
| `ctx.extend()` | child context metadata | scoped context derivation |
| `ctx.isolate()` | new service realm | multiple providers of same name |
| `ctx.intercept()` | scoped service config | service-specific overrides |
| `ctx.registry` | plugin runtime registry | introspection/debugging |

---

## 143. Fiber state cheat sheet

| State | Meaning | Coding implication |
|---|---|---|
| `PENDING` | mounted, requirements not ready | do not expect `apply()` yet |
| `LOADING` | activation running | setup/effects may be in progress |
| `ACTIVE` | current activation live | dependencies and registrations valid |
| `FAILED` | config/apply failed | inspect error/log and candidate rollback |
| `UNLOADING` | cleanup in progress | do not register new effects |
| `DISPOSED` | permanently removed | Fiber cannot simply reactivate |

---

## 144. Event mode cheat sheet

| Mode | Awaited? | Order | Stops early? | Typical use |
|---|---:|---|---:|---|
| `emit` | no | registration | no | notification |
| `parallel` | yes | concurrent | no | fan-out work |
| `serial` | yes | registration | yes | async decision |
| `bail` | no | registration | yes | sync decision |
| `waterfall` | depends on handlers | nested registration order | yes by omitting `next()` | policy/wrapping |

---

## 145. Harness extension cheat sheet

| Goal | Mechanism |
|---|---|
| Add LLM provider | `ctx.llm.registerAdapter(...)` |
| Add model-facing capability | `ctx.tools.register(defineTool(...))` |
| Add execution policy | tool/agent capability events |
| Add shell provider | shell service seam |
| Add filesystem provider | fs service seam |
| Add process confinement | sandbox service seam |
| Add background work | jobs service |
| Add human command | commands service |
| Add model context | agent/context APIs under owning subsystem |
| Observe durable facts | `session/event` + event type |
| Add replay-critical model-visible state | extend durable session event model |
| Give sessions/agents separate provider instances | isolated service realm/preset composition |

---
