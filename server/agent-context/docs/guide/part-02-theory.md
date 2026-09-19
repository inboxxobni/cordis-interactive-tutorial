<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 145-496 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: partial. -->

# Part II — The theory translated into engineering

## 4. Why “spatiotemporal composability” matters

The Cordis paper separates dynamic composition into two orthogonal problems.

### 4.1 Temporal composability

Question:

> Can a component withdraw its own in-process contributions later without leaving stale state or deleting independent contributions from other components?

Example problem:

```text
Plugin A registers tool A
Plugin B registers tool B
Plugin A registers event listener A
Plugin A starts timer A

later: unload A
```

Correct result:

```text
Tool A removed
Listener A removed
Timer A stopped
Tool B remains
Everything B owns remains
```

This is what **revertible effects** are for.

### 4.2 Spatial composability

Question:

> Can components stay valid while the live dependency graph changes?

Example:

```text
consumer injects 'llm'
        │
        └── currently resolved to Provider A

Provider A disappears
Provider B appears
```

The consumer must not keep a stale reference to A. Cordis reacts to the dependency change, unloads the consumer's active episode, and runs it again against the new provider when requirements are satisfied.

This is what **reactive coeffects** are for.

### 4.3 Why both are required

Dependency rebinding without cleanup leaves old registrations alive.

Cleanup without dependency rebinding leaves consumers calling dead providers.

Cordis combines both dimensions inside one `Context`/Fiber runtime.

---

## 5. Revertible effects

A revertible effect is conceptually:

```text
acquire / contribute
        ↓
   environment changed
        ↓
      disposer
        ↓
 contribution withdrawn
```

Canonical Cordis form:

```ts
ctx.effect(() => {
  const timer = setInterval(doWork, 1000)

  return () => {
    clearInterval(timer)
  }
})
```

### Rule

**If Cordis does not already own the resource, acquire it inside `ctx.effect()` and return cleanup.**

Bad:

```ts
export function apply(ctx: Context) {
  setInterval(doWork, 1000)
}
```

The timer outlives the plugin.

Good:

```ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(doWork, 1000)
    return () => clearInterval(timer)
  })
}
```

---

## 6. Disposer

A **disposer** is the concrete cleanup function.

Examples:

```ts
() => clearTimeout(timer)
() => socket.close()
() => watcher.close()
() => registry.delete(key)
() => abortController.abort()
```

A disposer may also be asynchronous:

```ts
ctx.effect(async () => {
  const connection = await openConnection()

  return async () => {
    await connection.flush()
    await connection.close()
  }
})
```

The Fiber waits for owned asynchronous cleanup to reach quiescence before disposal settles.

### Important implementation nuance

Current vendored Cordis allows effect setup to produce:

- one disposer;
- a promise of a disposer;
- an iterable of disposers;
- an async iterable of disposers.

Do not reach for generator effects unless they simplify a real incremental-acquisition case. A single effect with explicit cleanup is easier to audit.

---

## 7. Twisted composition and LIFO cleanup

The formal idea is that forward operations compose in acquisition order while inverses compose in reverse order.

```text
forward:   A → B → C
cleanup:   C⁻¹ → B⁻¹ → A⁻¹
```

Practical example:

```ts
ctx.effect(() => {
  const socket = openSocket()
  const subscription = socket.subscribe('events')

  return async () => {
    // reverse dependency order
    await subscription.unsubscribe()
    await socket.close()
  }
})
```

### Cordis teardown nuance

At the Fiber level, multiple top-level effects may be cleaned concurrently. Therefore:

> **If teardown operations have a required sequence, keep them inside one effect disposer and await them in the required order.**

Do not rely on timing between two independent asynchronous top-level effects.

Bad:

```ts
ctx.effect(() => {
  const db = openDb()
  return async () => db.close()
})

ctx.effect(() => {
  const writer = createWriter(/* depends on db */)
  return async () => writer.flush()
})
```

If ordering matters, combine ownership:

```ts
ctx.effect(() => {
  const db = openDb()
  const writer = createWriter(db)

  return async () => {
    await writer.flush()
    await writer.close()
    await db.close()
  }
})
```

---

## 8. Left inverse

The mathematical ideal is:

```text
g(f(c)) = c
```

where:

- `c` = starting context/environment;
- `f` = effect;
- `g` = cleanup/inverse.

In real systems this does **not** mean time travel.

You cannot un-send a network packet or erase an external observer's memory.

The coding rule is narrower:

> Make the plugin's **owned in-process contribution** disappear so the rest of the running system behaves as if that contribution were no longer mounted.

---

## 9. Observational equivalence

Recovery does not require every memory bit to become identical to an earlier snapshot.

The useful target is:

> After withdrawal, subsequent supported operations cannot distinguish the environment from one in which that component's contribution is absent, except for effects that are inherently external/irreversible and explicitly outside the recovery model.

This distinction is crucial for agent systems:

- a persisted session event cannot be “unhappened” by plugin disposal;
- an HTTP request already sent cannot be recalled;
- a file mutation may need a domain-specific compensation strategy;
- process-local registrations **can** and should be removed exactly.

Do not sell `ctx.effect()` as a transaction manager. It is lifecycle ownership, not distributed rollback.

---

## 10. Reactive coeffects

A coeffect expresses what a component needs from its environment.

In Cordis:

```ts
export const inject = ['tools', 'llm']

export function apply(ctx: Context) {
  // During this activation episode, both are available.
  ctx.tools
  ctx.llm
}
```

The key word is **reactive**.

Cordis continually ties activation to the implementations that satisfy the injection set.

Conceptually:

```text
missing dependency
      ↓
   PENDING
      ↓ provider appears
   LOADING
      ↓
    ACTIVE
      ↓ provider disappears/replaced
  UNLOADING
      ↓
   PENDING
      ↓ new provider appears
   LOADING
      ↓
    ACTIVE
```

This is more than a one-time dependency container lookup.

---

## 11. Dependency identity matters, not just dependency name

Suppose a plugin injects `shell`.

```text
'shell' → LocalShell#fiber-15
```

Then configuration replaces it with:

```text
'shell' → RemoteShell#fiber-29
```

Even though the **name** is still `shell`, the provider Fiber identity changed.

Cordis tracks the implementation episode. A dependent plugin can be reactivated so it no longer holds references captured from the former provider.

This is one of the most important reasons to use stable service names and avoid importing concrete provider implementations into consumers.

---

## 12. Theory-to-code mapping

| Formal / conceptual notion | Cordis mechanism | Coding-agent rule |
|---|---|---|
| Component | Plugin + mounted Fiber | Put independently replaceable behavior behind a plugin boundary |
| Effect | `ctx.effect()` or lifecycle-aware registration | Every contribution must have an owner |
| Revertible effect | acquisition + disposer | Acquire and clean up in the same lifecycle scope |
| Disposer | returned cleanup function | Make it idempotent/safe and await real cleanup |
| Reactive coeffect | `inject` + service resolver | Declare hard dependencies instead of assuming load order |
| Context | `ctx` proxy and scope | Resolve capabilities through stable service names |
| Dependency topology | service providers + injection graph | Consumers depend on interfaces/capabilities, not concrete providers |
| Temporal withdrawal | Fiber unload | Expect every owned registration to disappear |
| Spatial rebind | provider identity change → reactivation | Never cache provider references outside the owning activation episode |
| Observational recovery | complete removal of owned live contributions | Test absence of stale tool/listener/provider/handle state |
| Composition | `ctx.plugin()` and Loader tree | Make desired runtime structure explicit |
| Dynamic reconciliation | Loader/HMR | Stable IDs + reversible plugin design are mandatory |

---
