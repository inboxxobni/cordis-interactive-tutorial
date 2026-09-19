<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1430-1646 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part VII — Events

## 43. Service call vs event

Use a **Service method** when the caller knows which capability it wants and needs a result.

```ts
await ctx.shell.execute(request)
```

Use an **Event** when behavior is open to observers/interceptors and the producer should not know the consumers.

```ts
ctx.emit('stats/report', data)
```

Or:

```ts
await ctx.waterfall('policy/request', request, defaultHandler)
```

---

## 44. Declare typed events

```ts
import type { Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Events {
    'stats/report'(name: string, count: number): void
  }
}
```

Then:

```ts
ctx.on('stats/report', (name, count) => {
  console.log(name, count)
})

ctx.emit('stats/report', 'tool_call', 1)
```

The declaration merge gives compile-time typing. It does not automatically emit or register anything.

---

## 45. Event dispatch modes

### `emit` — synchronous broadcast

```ts
ctx.emit('feature/changed', payload)
```

- listeners invoked synchronously;
- values ignored;
- returned promises not awaited.

Use for cheap observation/notification where asynchronous completion is not part of the producer contract.

### `parallel` — await all listeners concurrently

```ts
await ctx.parallel('feature/flush', payload)
```

Use when all listeners must finish but do not depend on each other's order/results.

Current core aggregates failures after concurrent settlement.

### `serial` — ordered async short-circuit

```ts
const result = await ctx.serial('feature/check', input)
```

Listeners run in registration order and are awaited. First value other than `null`, `false`, or `undefined` bails out.

### `bail` — synchronous short-circuit

```ts
const result = ctx.bail('feature/check-sync', input)
```

Same bail condition, synchronous.

### `waterfall` — around-middleware

```ts
const result = await ctx.waterfall(
  'feature/transform',
  input,
  async () => defaultResult,
)
```

Listeners wrap downstream behavior.

---

## 46. Waterfall: the most dangerous event mode to misuse

Example:

```ts
ctx.on('demo/transform', async (input, next) => {
  const result = await next()
  return result.trim()
})
```

Another listener can intentionally intercept:

```ts
ctx.on('demo/transform', async (input, next) => {
  if (input.includes('blocked')) {
    return 'blocked'
  }

  return next()
})
```

### Absolute rule

> A waterfall listener that is only observing, logging, measuring, or annotating must call `next()`.

Bad logger:

```ts
ctx.on('agent/request', async (req, next) => {
  console.log(req)
  // forgot next() — downstream model request is swallowed
})
```

Correct:

```ts
ctx.on('agent/request', async (req, next) => {
  console.log(req)
  return next()
})
```

Missing `next()` is a deliberate veto, not an innocent omission.

---

## 47. Event listeners are effects

```ts
ctx.on('tools/result', handler)
```

belongs to the current Fiber and is removed automatically when that Fiber unloads.

Do not add manual global listener cleanup around ordinary `ctx.on()` unless you are intentionally disposing the listener earlier than plugin lifetime.

---

## 48. Cordis events vs durable Harness session events

This distinction prevents many architectural mistakes.

### Live Cordis events

Examples:

```text
agent/request
tools/result
approval/request
session/event
```

These are runtime dispatch surfaces.

### Durable session-event records

Examples:

```text
turn/start
step/start
user/message
assistant/chunk
assistant/message
tool/call
tool/result
turn/end
```

These are facts stored in the session log.

Do not assume a durable event type automatically has a same-named Cordis event.

To observe the durable stream, listen to the session subsystem's runtime event and inspect record type:

```ts
ctx.on('session/event', event => {
  if (event.type === 'tool/result') {
    // durable session fact
  }
})
```

### Rule

**If model-visible or replay-critical state must survive reload, it belongs in durable session history—not only in a transient Cordis event.**

---
