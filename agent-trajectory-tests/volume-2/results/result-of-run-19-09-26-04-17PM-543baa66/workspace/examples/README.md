# Examples

Working Cordis plugins, one per pattern. Every example is **verified**: it was
mounted into a real `@deepseek-ai/cordis` Context and its declared outcome
(Fiber state, logs, services) observed. Each file's header states what it
teaches and what to `Expect`. Find the closest one, read it, then adapt it.

Mount them with `mount_plugin` using the paths below, or copy one into the
workspace root and edit it.

## plugins/

| Pattern | Files | Expect |
|---|---|---|
| Smallest plugin (function form) | `plugins/01-function-plugin.mjs` | ACTIVE |
| Provide a service (class form) | `plugins/03-service-class.mjs` | ACTIVE, `greeter` resolves |
| Hard dependency (`inject`): PENDING then ACTIVE | `plugins/04-service-consumer.mjs` + `plugins/03-service-class.mjs` | consumer PENDING until provider mounts |
| Optional dependency (`ctx.get`) | `plugins/05-optional-dependency.mjs` | ACTIVE without the service |
| Effects: timer with disposer | `plugins/06-effect-timer.mjs` | ACTIVE; disposer runs on dispose/re-mount |
| Events: `ctx.on` / `ctx.emit` | `plugins/07-event-listener.mjs`, `plugins/08-event-emitter.mjs` | listener logs the emit |
| Waterfall middleware (must call `next()`) | `plugins/09-waterfall-listener.mjs`, `plugins/09-waterfall-caller.mjs` | `[hi]` |
| Config schema (Schemastery) | `plugins/10-config-schemastery.mjs` | valid ACTIVE; invalid FAILED before `apply()` |
| Tool on a `tools` service | `plugins/11-tools-service.mjs`, `plugins/12-tool-plugin.mjs` | tool plugin PENDING until service exists |
| Three-role capability (definition / provider / consumer, swap provider) | `plugins/13-capability-definition.mjs`, `plugins/13-capability-provider-local.mjs`, `plugins/13-capability-provider-shout.mjs`, `plugins/13-capability-consumer.mjs` | consumer survives provider replacement |
| What FAILED looks like | `plugins/14-deliberate-failure.mjs` | FAILED with the real error |
| Diagnosing PENDING (missing dependency) | `plugins/15-missing-dependency.mjs` | PENDING permanently |

## coding-agent/

A complete coding agent built from six plugins: `agent-loop.mjs`, `tools.mjs`,
`context-window.mjs`, `compaction.mjs`, `system-prompt.mjs`, `llm.mjs`. Read
`coding-agent/AGENT.md` first (inject chain, what a turn does, how to run it).
Mounted in any order, `agentLoop` ends ACTIVE once `tools`, `llm` and
`systemPrompt` all exist.

## Conventions shown across these files

- Plugins are modules with **named exports**: `name`, `inject`, `Config`, `apply`.
  There is no default-export plugin form. The class form exports the class as
  `apply` (`export { MyService as apply }`).
- Anything that outlives `apply()` lives in `ctx.effect()`.
- Resolve file paths from `import.meta.url`; read credentials from `process.env.CORDIS_AGENT_*`.

## Related docs

`docs/README.md` (topic index), `docs/this-sandbox.md`, `docs/guide/` (handbook).
