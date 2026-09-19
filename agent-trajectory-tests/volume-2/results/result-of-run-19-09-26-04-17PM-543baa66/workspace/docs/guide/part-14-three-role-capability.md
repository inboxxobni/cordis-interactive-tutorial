<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3207-3307 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XIV — Three-role capability design for real systems

## 96. Package layout

For a mature capability:

```text
packages/
  my-cap/
    definition/
      src/index.ts
    provider-local/
      src/index.ts
    provider-remote/
      src/index.ts
    tool-my-cap/
      src/index.ts
```

Definition:

```text
service class/interface
request/result types
shared stable domain vocabulary
```

Provider:

```text
implementation
environment-specific config
resource ownership
```

Consumer:

```text
tool
agent behavior
UI bridge
workflow
```

---

## 97. The Definition owns the contract

Bad dependency graph:

```text
tool imports local provider
remote provider imports tool types
```

Good:

```text
provider-local ─┐
provider-remote ├──► definition
consumer-tool ──┘
```

This is what makes replacement credible rather than nominal.

---

## 98. Resolve defaults explicitly

For a complex capability, do not smear fallback logic throughout execution:

```ts
const timeout = req.timeout ?? config.timeout ?? 30_000
const cwd = req.cwd ?? config.cwd ?? process.cwd()
```

Prefer an explicit resolution phase:

```ts
interface ResolvedSpec {
  timeoutMs: number
  cwd: string
}

function resolveRequest(
  request: Request,
  config: Config,
): ResolvedSpec {
  return {
    timeoutMs: request.timeoutMs ?? config.timeoutMs,
    cwd: request.cwd ?? config.cwd,
  }
}
```

Then execution uses the resolved spec.

This improves testability, diagnostics, and provider parity.

---
