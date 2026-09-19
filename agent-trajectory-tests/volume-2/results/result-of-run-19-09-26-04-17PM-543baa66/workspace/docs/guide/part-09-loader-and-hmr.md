<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1792-1963 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: acryl-only. -->

# Part IX — `cordis.yml`, Loader, reconciliation, and HMR

## 54. Minimal composition

```yaml
- name: './hello.ts'
```

Each row is a plugin entry.

A better long-lived config uses stable IDs:

```yaml
- id: hello
  name: './hello.ts'
```

---

## 55. Stable IDs are operationally important

Without a stable `id`, Loader may not be able to identify a row across configuration rereads as the same logical entry.

Use explicit IDs for application-level rows that should be reconciled rather than treated as unrelated removals/additions.

Good:

```yaml
- id: llm-provider
  name: './providers/deepseek.ts'

- id: my-tools
  name: './tools/index.ts'
```

---

## 56. `disabled`

Keep a row but prevent mounting:

```yaml
- id: experimental-feature
  name: './experimental.ts'
  disabled: true
```

Flip to false and dependency-gated consumers can activate as services appear.

This is preferable to commenting random pieces in and out when you want stable identity and patchability.

---

## 57. Groups and isolation

Harness docs show group-style composition for separate service realms.

Conceptual configuration:

```yaml
- id: group-a
  name: '@deepseek-ai/cordis-plugin-group'
  group: true
  isolate:
    shell: true
  config:
    - id: shell-a
      name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 5000
    - id: consumer-a
      name: './consumer-a.ts'

- id: group-b
  name: '@deepseek-ai/cordis-plugin-group'
  group: true
  isolate:
    shell: true
  config:
    - id: shell-b
      name: '@deepseek-ai/dsh-bash-local'
      config:
        timeoutMs: 60000
    - id: consumer-b
      name: './consumer-b.ts'
```

Both consumers inject `shell`, but service resolution is scoped.

---

## 58. HMR composition

Tutorial setup:

```yaml
- id: logger
  name: '@deepseek-ai/cordis-plugin-logger-console'

- id: timer
  name: '@deepseek-ai/cordis-plugin-timer'

- id: hmr
  name: '@deepseek-ai/cordis-plugin-hmr'
  config:
    root: ['.']

- id: hello
  name: './hello.ts'
```

HMR itself has dependencies. In the tutorial it needs the timer service for debounce and logs via Cordis logger.

This is a good illustration of Cordis philosophy: even the reload machinery participates in the same dependency system.

---

## 59. Harness-specific transactional reconciliation

DeepSeek Harness's vendored Loader/Include layer contains local hardening beyond the plain conceptual tutorial.

Its vendor manifest explicitly describes transactional behavior such as:

- import a changed candidate before disposing a working entry when possible;
- await lifecycle settlement;
- restore previous plugin/config when candidate application fails;
- reconcile grouped changes and undo partial changes on failure;
- validate Include candidate content before committing cached state;
- serialize Include child-tree mutation;
- keep failed dependencies `PENDING` rather than corrupting the live tree.

### Why this matters

HMR safety depends on two layers:

```text
Loader reconciliation correctness
            +
plugin effect/disposer correctness
```

Transactional Loader logic cannot save a plugin that leaked an unmanaged global timer or mutated an external singleton irreversibly.

---

## 60. HMR mental model

For a changed plugin:

```text
old code ACTIVE
     │
     ▼
unload old activation
     │ cleanup effects
     ▼
load candidate code
     │ validate/configure
     ▼
ACTIVE new code
```

With Harness reconciliation, failed candidate application can be contained/restored in more cases.

### Coding-agent requirement

A plugin must be written as if `apply()` can happen many times in one process.

If that assumption breaks the implementation, it is not HMR-safe.

---
