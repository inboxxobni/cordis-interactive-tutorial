<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4097-4143 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XXII — Coding-agent rules: MUST / SHOULD / MUST NOT

## 132. MUST

1. **MUST declare every hard service dependency.**
2. **MUST make every activation-owned resource disposable.**
3. **MUST assume a plugin can activate more than once in one process.**
4. **MUST validate deployment configuration before using it.**
5. **MUST use service/capability boundaries rather than concrete provider imports when replacement is intended.**
6. **MUST call `next()` in waterfall listeners unless intentionally vetoing/replacing downstream behavior.**
7. **MUST honor cancellation in tools/LLM/provider operations where the contract supplies a signal.**
8. **MUST keep canonical tool data separate from model/UI formatting.**
9. **MUST inspect the local vendored API/types before relying on upstream examples.**
10. **MUST test unload/reload, not only startup.**

---

## 133. SHOULD

1. **SHOULD use function plugins by default.**
2. **SHOULD use a `Service` class when exposing a direct capability.**
3. **SHOULD use stable config row IDs.**
4. **SHOULD keep order-dependent cleanup inside one disposer.**
5. **SHOULD namespace custom service and event names to avoid collisions.**
6. **SHOULD keep provider-specific logic behind a capability definition.**
7. **SHOULD use generated subsystem surfaces as the source of truth for Harness events/services.**
8. **SHOULD make configuration defaults safe and unsurprising.**
9. **SHOULD use durable session events for replay/model-visible facts.**
10. **SHOULD keep the bootstrap smaller and less dynamic than the Cordis-managed layer in self-updating systems.**

---

## 134. MUST NOT

1. **MUST NOT rely on `cordis.yml` line order for dependency readiness.**
2. **MUST NOT leave raw timers/watchers/listeners outside ownership.**
3. **MUST NOT cache required provider references across activation episodes.**
4. **MUST NOT treat `PENDING` as automatically erroneous.**
5. **MUST NOT assume `INACTIVE` is a current Fiber enum state.**
6. **MUST NOT invent `ctx.fork()` for generic Context branching.**
7. **MUST NOT treat service isolation as a sandbox.**
8. **MUST NOT let a logging waterfall hook omit `next()`.**
9. **MUST NOT make programmatic callers parse rendered tool prose for IDs/fields.**
10. **MUST NOT assume plugin disposal reverses irreversible external history.**

---
