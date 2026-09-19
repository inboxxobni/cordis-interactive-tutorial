<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3468-3526 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XVI — Coding-agent decision framework

## 104. Given a feature request, choose the Cordis mechanism

| Need | Prefer |
|---|---|
| Independently mount/unmount behavior | plugin |
| Direct callable capability | Service |
| Hard dependency on capability | `inject` |
| Optional capability | `ctx.get()` or dependency-gated sub-plugin |
| Raw resource with cleanup | `ctx.effect()` |
| Observe a runtime occurrence | event listener |
| Multiple async observers must complete | `parallel` event |
| Ordered decision chain | `serial` / `bail` |
| Around-policy / interception | `waterfall` |
| Model-callable operation | `ctx.tools.register(defineTool(...))` |
| New model provider | `ctx.llm.registerAdapter(...)` |
| Replaceable implementation family | Definition + Provider + Consumer seam |
| Per-subtree provider | service isolation |
| Per-subtree service config | intercept mechanism if service supports it |
| Runtime composition change | Loader config / patch |
| Source hot-swap | HMR + reversible plugin |
| Durable model-visible fact | session event/log, not only live event |
| Background task | jobs subsystem, not detached promise |

---

## 105. Coding-agent implementation algorithm

When asked to add a feature:

```text
1. Identify the owning domain/capability.
2. Search generated subsystem docs and package types.
3. Decide whether this is:
   - service capability,
   - provider,
   - consumer,
   - tool,
   - event hook,
   - policy wrapper,
   - configuration composition.
4. List required services.
5. Put hard dependencies in inject.
6. List every side effect created during activation.
7. Make each effect lifecycle-owned.
8. Add validated config for deployment-specific values.
9. Use stable config entry IDs.
10. Test initial activation.
11. Test missing dependencies → PENDING.
12. Test provider removal/replacement.
13. Test plugin disposal.
14. Test config reload/HMR.
15. Assert no duplicate/stale registrations.
16. If model-visible behavior changed, test durable session/replay implications.
```

---
