<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4190-4303 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: acryl-only. -->

# Part XXIV — Applying the model to an ACRYL-style agent platform

## 136. Recommended Cordis decomposition

For an agent-agnostic runtime, treat major swappable systems as capability seams rather than hardwired imports.

Example conceptual tree:

```text
ACRYL / agent runtime
├── session store service
├── agent adapter registry
│   ├── Codex provider
│   ├── Claude provider
│   └── Pi provider
├── context compaction service
│   ├── provider A
│   └── provider B
├── memory service
│   ├── local
│   └── remote
├── codebase graph service
│   ├── graph provider A
│   └── graph provider B
├── shell / filesystem realm
├── approval policy
├── handoff/relay workflow
├── tool families
├── UI/TUI surface plugins
└── telemetry/trace observers
```

Each provider should be selectable by composition, not by editing consumers.

---

## 137. Example: agent adapter seam

Definition:

```ts
abstract class CodingAgentService extends Service {
  abstract startSession(spec: StartSpec): Promise<AgentSession>
  abstract resumeSession(id: string): Promise<AgentSession>
  abstract stopSession(id: string): Promise<void>
}
```

Providers:

```text
CodexAdapter
ClaudeAdapter
PiAdapter
OpenCodeAdapter
```

Consumers:

```text
relay workflow
session UI
handoff tool
multi-agent orchestrator
```

Consumers inject a stable capability. They should not import each provider package directly.

---

## 138. Example: optional memory

If an agent runtime works without memory:

```ts
export function apply(ctx: Context) {
  const memory = ctx.get('memory')
  // enhance if present
}
```

If a particular plugin is specifically a “memory-grounded planner,” then memory is required:

```ts
export const inject = ['memory']
```

The dependency semantics should express product truth.

---

## 139. Example: hot-swapping context graph provider

A context graph consumer should depend on:

```text
ctx.codeGraph
```

not:

```text
OmniGraph SDK concrete client
Lat.md concrete implementation
```

Then composition can choose provider per workspace/agent realm.

If the provider is replaced, consumers' active episodes restart cleanly against the new provider.

That is exactly the kind of system Cordis is designed to make tractable.

---
