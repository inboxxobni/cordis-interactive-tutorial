<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3527-3682 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XVII — Debugging

## 106. Plugin prints nothing

Check in this order:

```text
1. Is the row in effective config?
   dsh --profile <name> --dump-config

2. Is module path/name resolvable?

3. Is row disabled?

4. What is Fiber state?

5. Is it PENDING because an injected service is absent?

6. Is the provider itself PENDING on another service?

7. Did Config validation fail?

8. Is a logger exporter present for the diagnostic path?

9. Did a source/HMR candidate fail and get rolled back?
```

Do not add sleep/retry hacks before understanding the dependency graph.

---

## 107. Diagnose PENDING Fibers

Tutorial pattern:

```ts
import { FiberState, type Context } from '@deepseek-ai/cordis'

export const name = 'diagnose'

export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setTimeout(() => {
      for (const runtime of ctx.registry.values()) {
        for (const fiber of runtime.fibers) {
          if (fiber.state === FiberState.PENDING) {
            console.log(
              `${fiber.name} is PENDING — check required services`,
            )
          }
        }
      }
    }, 500)

    return () => clearTimeout(timer)
  })
}
```

Notice that even the diagnostic timer is lifecycle-owned.

---

## 108. Duplicate tool/listener after HMR

Symptom:

```text
one save → handler fires twice
second save → three times
```

Likely cause:

```text
registration happened outside Cordis effect ownership
```

Audit:

```text
ctx.on                → already owned
ctx.tools.register    → should be owned by tools registry
ctx.llm.register...   → should be owned
raw emitter.on        → must wrap
setInterval           → must wrap
third-party callback  → likely must wrap
module-scope mutable singleton → suspicious
```

---

## 109. Provider swap causes stale calls

Likely causes:

- consumer did not declare `inject`;
- provider object copied into module-global state;
- asynchronous work escaped the activation lifecycle;
- callback registered outside Fiber ownership;
- optional lookup was cached forever.

Correct pattern:

```ts
export const inject = ['provider']

export function apply(ctx: Context) {
  // capture ctx.provider only inside resources owned by this activation
}
```

---

## 110. Waterfall suddenly stops core behavior

Inspect every listener on that waterfall.

Find one that logs/annotates but does not:

```ts
return next()
```

This is one of the highest-value Cordis debugging heuristics.

---

## 111. Plugin fails only after config edit

Check:

- schema mismatch;
- patch replaced whole config instead of deep-merging;
- `!!js` expression evaluates only after required injections and now sees a different provider/context;
- stable row ID missing;
- HMR candidate import/build error;
- provider change triggered a consumer restart that reveals an unmanaged global.

---

## 112. Cleanup hangs

Look for:

- async disposer waiting forever;
- work not observing abort signal;
- disposer waiting on an event emitted only by already-disposed child;
- circular cleanup dependency between independent effects;
- detached background work not managed by jobs;
- external SDK close/flush without timeout semantics.

If cleanup order is important, consolidate it in one effect.

---
