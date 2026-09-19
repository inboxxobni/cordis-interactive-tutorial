<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 728-1026 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part IV — Plugins and Fibers

## 21. The three plugin shapes

Cordis accepts three practical forms.

### 21.1 Function plugin — default choice

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello'

export function apply(ctx: Context) {
  console.log('hello')
}
```

A function itself can also be mounted:

```ts
function heartbeat(ctx: Context) {
  // ...
}

ctx.plugin(heartbeat)
```

### 21.2 Object plugin

```ts
export const plugin = {
  name: 'object-plugin',
  inject: ['tools'],
  apply(ctx: Context) {
    // ...
  },
}
```

### 21.3 Class plugin / Service subclass

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export class MyService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'myService')
  }
}
```

Use class form when the plugin naturally **provides a service** or benefits from a service object's public methods/state.

### Default decision

```text
Need lifecycle only?         → function plugin
Need structured object form? → object plugin
Need to provide service API? → Service class
```

---

## 22. Plugin metadata

Current plugin runtime understands metadata such as:

```ts
export const name = 'my-plugin'
export const inject = ['tools', 'llm']
export const Config = /* Standard Schema */
```

At the underlying runtime type level there are also concepts such as `provide` and `intercept` metadata. Ordinary Harness authors should follow subsystem examples instead of manually manipulating low-level metadata without need.

---

## 23. `ctx.plugin()`

```ts
const fiber = ctx.plugin(myPlugin, config)
```

This:

1. resolves the plugin shape;
2. creates/reuses a plugin runtime record;
3. creates a child Fiber;
4. creates a child Context bound to that Fiber;
5. normalizes injection declarations;
6. waits for requirements;
7. validates configuration when activation is possible;
8. executes the plugin;
9. tracks all owned effects;
10. returns a Fiber-like thenable.

You can await initial settlement:

```ts
const fiber = await ctx.plugin(myPlugin)
```

Or keep the handle:

```ts
const fiber = ctx.plugin(myPlugin)
await fiber.await()
```

---

## 24. `ctx.inject()` shorthand

For localized dependency-gated behavior:

```ts
ctx.inject(['tools'], (ctx) => {
  // active only while tools exists
})
```

Conceptually it is shorthand for mounting a plugin with that injection declaration.

This is useful when a larger service/class needs one method or sub-behavior to come alive only under additional dependencies.

Do not use it to hide the primary dependencies of a top-level plugin. Those should remain visible in the plugin's `inject` metadata.

---

## 25. Fiber state machine — actual current states

The current vendored implementation exposes:

```text
PENDING
LOADING
ACTIVE
FAILED
UNLOADING
DISPOSED
```

Useful transition model:

```text
                         apply/config error
                              ┌───────► FAILED
                              │
PENDING ──deps ready────► LOADING ─────► ACTIVE
   ▲                                    │
   │                                    │ dependency/provider change
   │                                    │ restart/update/HMR
   │                                    ▼
   └────────────────────────────── UNLOADING
                                      │
                                      ├── still mounted, requirements absent
                                      │       → PENDING
                                      │
                                      ├── requirements already satisfied/new epoch
                                      │       → LOADING
                                      │
                                      └── explicit permanent disposal
                                              → DISPOSED
```

### Important correction: `INACTIVE`

Some conceptual explanations use the word **inactive**, but current `FiberState` does not export an `INACTIVE` enum member.

Treat “inactive” as a conceptual condition, not an enum constant.

### Important correction: temporary dependency loss ≠ permanent disposal

A service disappearing does not necessarily destroy the Fiber forever.

The active episode unloads. The mounted Fiber may settle back into `PENDING` and reactivate later.

`DISPOSED` means the Fiber's runtime identity has been explicitly removed and it cannot restart normally.

---

## 26. `PENDING` is not an error

A plugin in `PENDING` is saying:

```text
“I am mounted, but my declared environment does not currently exist.”
```

This is a valid state because a provider may appear later.

Therefore this can exit silently:

```ts
export const inject = ['doesNotExist']

export function apply(ctx: Context) {
  console.log('never prints while missing')
}
```

If nothing else keeps Node alive, the process can even exit cleanly.

### Diagnostic rule

When a plugin “does nothing,” inspect Fiber state before assuming its `apply()` is broken.

---

## 27. Fiber methods a coding agent should know

### Await stable initial state

```ts
await fiber.await()
```

Startup/config errors are rethrown.

### Permanently dispose mounted instance

```ts
await fiber.dispose()
```

Waits for owned cleanup and children.

### Restart current plugin

```ts
await fiber.restart()
```

Unload and activate again using current configuration/dependencies.

### Update config

```ts
await fiber.update(newConfig)
```

Validation/reconciliation hooks can participate.

### Inspect effects

Current Fiber provides diagnostic metadata for live effects:

```ts
fiber.getEffects()
```

This can be valuable when hunting lifecycle leaks.

---

## 28. The Registry

Every Context exposes the plugin registry:

```ts
ctx.registry
```

Diagnostic example:

```ts
import { FiberState, type Context } from '@deepseek-ai/cordis'

export function apply(ctx: Context) {
  for (const runtime of ctx.registry.values()) {
    for (const fiber of runtime.fibers) {
      console.log({
        name: fiber.name,
        state: FiberState[fiber.state],
        uid: fiber.uid,
      })
    }
  }
}
```

Depending on TS enum emission/const-enum setup, direct reverse lookup may not be available in every build; the tutorial's robust check is comparing to `FiberState.PENDING` and logging the name.

### Use Registry for

- diagnostics;
- runtime introspection tooling;
- developer panels;
- HMR/debugging tests.

### Do not use Registry for

- ordinary cross-plugin business calls;
- searching for a concrete provider instead of defining a service dependency;
- creating hidden load-order coupling.

---
