<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1964-2086 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: partial. -->

# Part X — DeepSeek Harness: Cordis becomes an agent runtime

## 61. Agent Harness definition

An agent harness is the surrounding execution environment that turns a model into an operational agent.

It supplies things such as:

```text
system prompts
model providers
model-tool loop
tools
sessions/history
permissions/approval
storage
filesystem/shell
sandboxing
background jobs
agent coordination
UI/CLI surfaces
telemetry
```

Cordis manages composition. Harness defines these domain capabilities.

---

## 62. Important built-in Harness service names

The exact generated subsystem docs and TypeScript types are authoritative, but major current services include:

| Capability | Typical `ctx` key | Purpose |
|---|---|---|
| Session log/runtime | `ctx.sessions` | durable session event store, fork/resume primitives |
| System prompt | `ctx.systemPrompt` | assembled prompt sections and tool schema contribution |
| Tool runtime | `ctx.tools` | model-visible tool registry and guarded execution pipeline |
| Live agents | `ctx.agents` | active agent handles and agent events |
| Agent loop | `ctx.agentLoop` | default turn/step driver |
| LLM | `ctx.llm` | provider-neutral generation and adapter routing |
| Shell | `ctx.shell` | shell capability seam |
| Filesystem | `ctx.fs` | filesystem capability seam |
| Sandbox | `ctx.sandbox` | process/file confinement integration |
| Jobs | `ctx.jobs` | durable-ish runtime ownership of background work |
| Commands | `ctx.commands` | human/runtime commands that do not require model tool selection |

Before using any service, inspect its owning subsystem docs and package declarations because Harness is evolving quickly.

---

## 63. Turn and Step

Current Harness architecture defines:

### Step

One model request plus the tool executions caused by the response.

### Turn

Zero or more steps that drain one accepted input until no additional work is owed.

Simplified flow:

```text
turn/start
  claim input
  assemble prompt + tool schemas
  agent/pre-step
    step/start
      persist user/message
      derive model history
      agent/request
        llm/stream
          assistant/chunk*
          assistant/message
      tool/call*
        tools/pre-execute
        tools/execute
        tools/post-execute
        tool/result*
    step/end
    maybe another step
  agent/turn-stopping
turn/end
```

### “Round”

Do not treat `round` as a universal Cordis runtime primitive.

Where a strategy/outer-loop package uses “round,” follow that package's contract. In the current core architecture, **Turn** and **Step** are the primary loop terms.

---

## 64. “Everything is a plugin” does not mean “everything is a separate package”

It means major runtime capabilities can be mounted and replaced through the composition model.

Good plugin boundary:

```text
LLM provider
filesystem provider
permission policy
tool family
memory/context system
agent loop strategy
UI surface
```

Usually bad plugin boundary:

```text
one tiny pure helper function
one constant
one local data transform with no lifecycle/config/replacement need
```

Make a unit a plugin when lifecycle, replacement, configuration, ownership, or dependency topology matters.

---
