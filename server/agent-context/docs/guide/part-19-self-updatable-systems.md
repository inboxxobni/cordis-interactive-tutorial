<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3845-3915 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XIX — Designing self-updatable systems with Cordis

## 122. What Cordis makes dynamically replaceable

Cordis is especially strong for **in-process higher layers**:

```text
agent behavior
model adapters
tools
policies
memory/context services
prompt contributors
workflows
runtime registries
UI/plugin adapters
configuration-selected providers
```

These can be represented as plugin/service/effect surfaces and reconciled at runtime.

---

## 123. What Cordis does not magically hot-swap

Some layers remain host/bootstrap concerns:

```text
Node/Electron executable
native ABI changes
OS entitlements
code signing
preload security boundary
Chromium runtime flags
native .node modules with incompatible ABI
installer/updater itself
process-level crashes
```

A self-updating application should separate:

```text
small stable bootstrap / host
          +
large Cordis-managed dynamic layer
```

The dynamic layer can evolve aggressively while the bootstrap owns restart, binary replacement, code-signing, and rollback when a process restart is unavoidable.

---

## 124. Safe self-modification rule

An agent that edits a Cordis plugin should not immediately mutate arbitrary live global state.

Preferred loop:

```text
1. edit plugin source/config
2. build/typecheck/test candidate
3. Loader/HMR imports candidate
4. reconcile old → candidate
5. await lifecycle settlement
6. observe health checks
7. keep candidate or restore previous composition
```

DeepSeek Harness's transactional Loader patches are useful here, but they are only one part of the safety story.

---
