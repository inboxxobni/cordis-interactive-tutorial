<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4637-4663 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Appendix C — 30-second onboarding prompt for another coding agent

Use this when delegating Cordis work to a sub-agent:

```text
This repository uses DeepSeek Harness's vendored @deepseek-ai/cordis.
Treat vendor/cordis and generated subsystem types/docs as authoritative over generic
upstream examples. Cordis plugins are lifecycle units. Hard service requirements go
in inject and are live: consumers unload/re-activate when provider implementations
change. Every registration/resource must be owned by the current Fiber; ctx.on,
ctx.plugin, service provisioning, ctx.tools.register and ctx.llm.registerAdapter are
lifecycle-aware, while raw timers/watchers/connections must be wrapped in ctx.effect
with cleanup. PENDING is a valid missing-dependency state. Current Fiber states are
PENDING, LOADING, ACTIVE, FAILED, UNLOADING, DISPOSED; there is no public INACTIVE
enum. Use services for direct capabilities, events for open extension points, and
always call next() in waterfall observers unless intentionally vetoing. A Harness
tool is not a Cordis primitive: it is registered into ctx.tools and should return a
canonical typed value separate from model/UI rendering. Assume plugins can be hot-
reloaded and activated repeatedly. Test provider removal/replacement and disposal,
not only startup. Before coding, inspect the owning docs/subsystems page and local
package types.
```

---

**End of guide.**
