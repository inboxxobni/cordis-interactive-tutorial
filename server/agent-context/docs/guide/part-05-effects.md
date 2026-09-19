<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1027-1184 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part V — Effects: the non-negotiable lifecycle discipline

## 29. What is already an effect

Many Cordis/Harness registration APIs already attach cleanup to the current Fiber.

Examples include:

```ts
ctx.on(...)
ctx.once(...)
ctx.plugin(...)
```

And Harness registries are designed similarly:

```ts
ctx.tools.register(...)
ctx.llm.registerAdapter(...)
```

Service provisioning is also lifecycle-owned.

Therefore you should not wrap every Cordis helper in another `ctx.effect()` mechanically.

---

## 30. When to write `ctx.effect()` yourself

Use it for resources Cordis does not know how to clean up.

Common cases:

```text
setTimeout / setInterval
filesystem watcher
WebSocket / TCP connection
message-broker subscription
child process not owned by another Harness service
third-party event emitter registration
temporary file / lock
native handle
background queue worker
external SDK subscription
```

Example watcher:

```ts
ctx.effect(() => {
  const watcher = watch(directory, onChange)
  return () => watcher.close()
})
```

Example emitter:

```ts
ctx.effect(() => {
  emitter.on('data', onData)
  return () => emitter.off('data', onData)
})
```

---

## 31. Effect anti-pattern: acquire outside the effect

Risky:

```ts
const socket = openSocket()

export function apply(ctx: Context) {
  ctx.effect(() => {
    return () => socket.close()
  })
}
```

The resource does not have a clean one-to-one relation to the plugin activation episode.

Preferred:

```ts
export function apply(ctx: Context) {
  ctx.effect(() => {
    const socket = openSocket()
    return () => socket.close()
  })
}
```

This keeps acquisition and release inside one owner scope.

---

## 32. Effect anti-pattern: fire-and-forget asynchronous setup

Bad:

```ts
export function apply(ctx: Context) {
  void connect().then(connection => {
    // Now who owns this if the plugin unloaded before connect resolved?
  })
}
```

Better:

```ts
export function apply(ctx: Context) {
  ctx.effect(async () => {
    const connection = await connect()
    return () => connection.close()
  })
}
```

Harness's vendored Cordis includes lifecycle hardening specifically around re-entrant/async setup and disposal. Use the framework path instead of rebuilding ownership yourself.

---

## 33. Effect anti-pattern: cleanup creates new long-lived effects

During unload, the owner is leaving. Do not register replacement listeners/timers from a disposer unless the owning architecture explicitly creates a new Fiber elsewhere.

Current vendored lifecycle hardening rejects effect creation while a Fiber is `UNLOADING`.

This is a useful invariant:

```text
cleanup removes ownership
cleanup does not secretly extend ownership
```

---

## 34. Effect audit checklist

For every plugin, a coding agent should ask:

```text
[ ] What does apply() add to the process?
[ ] Which additions are already lifecycle-aware APIs?
[ ] Which additions need ctx.effect()?
[ ] Can asynchronous setup complete after unload begins?
[ ] Does the framework own that race, or did I create a detached promise?
[ ] Does each disposer fully quiesce its resource?
[ ] Does cleanup depend on another cleanup ordering?
[ ] If yes, are those steps inside one disposer?
[ ] Does any callback retain ctx/service references after unload?
[ ] Can an external irreversible side effect occur? If so, is that consciously outside rollback semantics?
```

---
