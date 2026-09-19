<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4030-4096 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XXI — Practical reference: “what should I use?”

## 130. Plugin vs Service vs Tool vs Event

```text
Plugin
  = lifecycle/replacement unit

Service
  = direct named capability consumed by code

Tool
  = model-callable operation registered in Harness tools service

Event
  = open runtime notification/interception contract
```

A single feature may involve all four:

```text
Plugin: Git provider plugin
Service: ctx.git
Tool: git_status
Events: git/pre-operation, git/result
```

Do not make one concept impersonate another.

---

## 131. Service vs event decision examples

### Need current database result

```ts
await ctx.database.query(...)
```

Service.

### Notify plugins that session title changed

```ts
ctx.emit('session/title-changed', ...)
```

Event.

### Allow policies to wrap model request

```ts
ctx.waterfall('agent/request', ..., next)
```

Waterfall event.

### Allow model to query database

```ts
ctx.tools.register(defineTool(...))
```

Tool consumer over database Service.

---
