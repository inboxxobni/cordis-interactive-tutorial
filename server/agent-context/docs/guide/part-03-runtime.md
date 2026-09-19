<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 497-727 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part III — The actual Cordis runtime

## 13. Target the right Cordis

There are two closely related targets:

### Upstream

```text
cordiverse/cordis
npm: cordis
```

### DeepSeek Harness vendored/rescoped line

```text
deepseek-ai/deepseek-harness/vendor/cordis
package: @deepseek-ai/cordis
```

At the inspected 2026-08-24 Harness snapshot, the vendor manifest records the
upstream source provenance:

```text
@deepseek-ai/cordis
upstream package: cordis
upstream version snapshot: 4.0.0-rc.7
upstream commit: 56b3d4f725681cf4556c1a8695a709cc3b6eed74
```

The rescoped package published by this pinned Harness checkout is currently
`@deepseek-ai/cordis` `4.0.1`. The upstream snapshot version documents source
provenance; the rescoped package version is the dependency/runtime version ACRYL
must satisfy.

Harness also carries local changes, including lifecycle hardening, lazy config resolution, and transactional Loader/Include reconciliation.

### Coding-agent rule

**When working inside DeepSeek Harness, treat its vendored source and generated Harness docs/types as authoritative.**

Do not copy an upstream Cordis example blindly if its API or Loader behavior differs.

Before implementing a nontrivial feature, inspect locally:

```text
vendor/cordis/src/
vendor/loader/src/
vendor/include/src/
vendor/hmr/src/
docs/cordis-primer.md
docs/cordis-tutorial/
docs/subsystems/
```

---

## 14. Creating the root Context

Pure Cordis can start with:

```ts
import { Context } from '@deepseek-ai/cordis'

const root = new Context()
```

The root Context creates core runtime machinery including:

```text
ctx.events
ctx.logger
ctx.reflect
ctx.registry
ctx.fiber
ctx.root
```

Harness normally creates the composition for you, so ordinary Harness plugins receive `ctx` rather than constructing another root.

### Rule

**Do not create random root Contexts inside feature plugins.**

A second root is a second dependency universe. Use child/scoped contexts only when isolation is intentional.

---

## 15. What `ctx` really is

The current Context is a Proxy-backed scoped environment.

It serves four jobs simultaneously:

1. **capability lookup** — `ctx.llm`, `ctx.tools`, `ctx.myService`;
2. **lifecycle ownership** — `ctx.effect`, `ctx.plugin`, `ctx.on`;
3. **event dispatch** — `ctx.emit`, `ctx.waterfall`, etc.;
4. **scope definition** — isolation/intercept behavior and current Fiber.

You should think:

```text
ctx = “the world this plugin is currently allowed to see and modify”
```

not:

```text
ctx = “a bag of global singleton objects”
```

---

## 16. Context API: core practical surface

Common public operations:

```ts
ctx.plugin(plugin, config?)
ctx.inject(dependencies, callback)
ctx.effect(effectBody)

ctx.on(event, listener, options?)
ctx.once(event, listener, options?)
ctx.emit(event, ...args)
ctx.parallel(event, ...args)
ctx.serial(event, ...args)
ctx.bail(event, ...args)
ctx.waterfall(event, ...args, next)

ctx.get('serviceName')

ctx.extend(meta?)
ctx.isolate('serviceName', label?)
ctx.intercept('serviceName', config)

ctx.registry
ctx.fiber
ctx.logger
ctx.root
```

Exact package-specific additions come through TypeScript declaration merging. In Harness, importing the package that owns a service/event surface is often required for types.

---

## 17. `extend()` — make a scoped child view

`extend(meta)` creates a child Context that prototypically inherits its parent and can carry extra metadata.

```ts
const child = ctx.extend({ requestId: 'r-123' })
```

The parent is not mutated.

Use this when a subsystem intentionally propagates scoped metadata.

Do **not** use `extend` as an arbitrary global state mechanism.

---

## 18. `isolate()` — create a separate service realm

```ts
const isolated = ctx.isolate('shell')
```

Below this child context, the named service resolves in a different isolation realm.

This is what allows two plugin groups to each have their own `shell` implementation under the same service name.

Conceptual example:

```text
root
├── group A  isolate(shell=A)
│   ├── LocalShell(timeout=5s)
│   └── agent A → ctx.shell = A's shell
│
└── group B  isolate(shell=B)
    ├── LocalShell(timeout=60s)
    └── agent B → ctx.shell = B's shell
```

### Important

Service isolation is **not a security sandbox**.

It changes Cordis resolution scope; it does not stop plugin code from using Node APIs directly.

---

## 19. `intercept()` — scoped service configuration

A service can expose interceptable configuration. A child context may provide an override:

```ts
const child = ctx.intercept('someService', {
  timeoutMs: 5000,
})
```

The service resolves config by combining intercept layers according to its contract.

This is advanced. Prefer ordinary plugin configuration until a service explicitly supports scoped interception and there is a real need for per-subtree behavior.

---

## 20. There is no generic `ctx.fork()` in current public Context API

The term **fork** is overloaded in architecture discussions.

Do not invent:

```ts
ctx.fork() // not the generic public Context API described by current source
```

Use the correct mechanism:

- mount a child lifecycle → `ctx.plugin(...)`;
- derive child context metadata → `ctx.extend(...)`;
- create a service realm → `ctx.isolate(...)`;
- alter scoped service config → `ctx.intercept(...)`;
- fork a **Harness session** → the session subsystem's `ctx.sessions.fork(...)` API, which is a completely different domain concept.

A coding agent must distinguish **context scope** from **session history fork**.

---
