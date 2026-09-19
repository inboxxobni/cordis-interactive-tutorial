<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4438-4496 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XXVII — Final operating principles

## 146. The Cordis discipline

A Cordis system remains comprehensible when every dynamic contribution can answer four questions:

```text
1. Who owns me?
2. What do I require?
3. How do I leave?
4. What happens when my provider changes?
```

If any answer is “some global singleton probably handles it,” the design is incomplete.

---

## 147. The most important invariants

### Ownership invariant

Every live registration/resource has one lifecycle owner.

### Dependency invariant

Every hard capability dependency is declared and reactively tracked.

### Re-entry invariant

A plugin may activate repeatedly without accumulating stale state.

### Replacement invariant

A consumer does not retain a retired provider across activation episodes.

### Event invariant

Waterfall delegation is explicit; observation cannot accidentally suppress core behavior.

### Tool invariant

Programmatic value, model-facing rendering, and UI presentation remain distinct.

### Durability invariant

Model-visible/replay-critical facts come from durable session state, not ephemeral callbacks alone.

### Security invariant

Cordis composition/isolation is not mistaken for OS-level sandboxing.

---

## 148. The one paragraph a coding agent should remember

When adding behavior to a Cordis system, make it a plugin only if it benefits from independent lifecycle or composition. Declare every required capability with `inject`; access providers through stable service names rather than concrete implementations. Treat every registration and resource as an owned effect, using lifecycle-aware Cordis/Harness registries when available and `ctx.effect()` for everything else. Expect provider loss, config updates, HMR, and repeated activation. Use services for direct capabilities, events for open observation/interception, waterfalls only with deliberate `next()` semantics, tools for model-callable APIs with canonical typed values, and durable session events for facts that must survive replay. Then test not only whether the component starts, but whether it can leave and return without leaving a trace it does not own.

---
