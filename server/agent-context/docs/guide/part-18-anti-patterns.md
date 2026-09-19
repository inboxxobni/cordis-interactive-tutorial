<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3683-3844 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XVIII — Anti-pattern catalog

## 113. Importing concrete providers in consumers

Bad:

```ts
import { LocalShell } from '@my/local-shell'
```

inside a tool that should work with any shell implementation.

Better:

```ts
export const inject = ['shell']

export function apply(ctx: Context) {
  return ctx.shell.execute(...)
}
```

---

## 114. Encoding load order in YAML

Bad:

```text
“put provider three lines earlier”
```

Correct:

```ts
inject = ['provider']
```

---

## 115. Global mutable registry outside lifecycle

Bad:

```ts
GLOBAL_TOOLS.push(tool)
```

with no inverse.

Correct:

```ts
const remove = registry.register(tool)
ctx.effect(() => remove)
```

or use the framework's lifecycle-aware registry API.

---

## 116. Detached promises

Bad:

```ts
void longRunningWork()
```

when it outlives activation and mutates state.

Use:

- an effect with async cleanup;
- cancellation signal;
- jobs subsystem for published background tasks;
- a child plugin whose Fiber owns the work.

---

## 117. Tool returns prose instead of data

Bad:

```text
"Job started with id job-17"
```

Better:

```json
{
  "kind": "background",
  "jobId": "job-17"
}
```

Render prose separately.

---

## 118. Optional capability declared as hard dependency unnecessarily

If metrics are optional, this:

```ts
inject = ['metrics']
```

can disable an otherwise useful plugin.

Use optional lookup or a small injected sub-plugin.

---

## 119. Required capability treated as optional

Opposite problem:

```ts
const shell = ctx.get('shell')
if (!shell) return
```

for a plugin whose sole purpose requires shell.

This hides misconfiguration.

Use `inject = ['shell']` and let `PENDING` express the dependency contract.

---

## 120. Treating isolation as security

`ctx.isolate('shell')` prevents service resolution collisions.

It does not stop arbitrary plugin code from:

```ts
import fs from 'node:fs'
```

Security requires sandbox/process/permission boundaries from the appropriate subsystem/OS layer.

---

## 121. Assuming effect cleanup can undo external history

A disposer can close a socket.

It cannot retract:

- packets already sent;
- messages already published externally;
- money already transferred;
- durable session events already committed;
- files overwritten without a saved inverse.

For those domains, use compensation/idempotency/versioning/transaction protocols appropriate to the external system.

---
