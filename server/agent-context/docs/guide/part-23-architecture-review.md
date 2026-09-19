<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4144-4189 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: partial. -->

# Part XXIII — Architecture review template for coding agents

## 135. Before implementing a Cordis feature, write this mini-design

```md
## Capability
What domain does this belong to?

## Plugin boundary
Why should this behavior have independent lifecycle/config/replacement?

## Provides
Which service(s), tool(s), event(s), or session facts does it provide?

## Injects
Which required services must exist before activation?

## Optional dependencies
Which capabilities improve behavior but are not required?

## Effects
List every process-local side effect created while active.

## Disposal
How does each effect quiesce?

## Config
Which deployment-dependent values are validated fields?

## Events
Which event mode is used and why?

## HMR/replacement
What happens when this plugin or one of its providers changes?

## Durable state
Does anything model-visible or replay-critical need a session event?

## Tests
How do we prove mount → use → unload → remount is clean?
```

A coding agent should be able to answer every section before merging a new core capability.

---
