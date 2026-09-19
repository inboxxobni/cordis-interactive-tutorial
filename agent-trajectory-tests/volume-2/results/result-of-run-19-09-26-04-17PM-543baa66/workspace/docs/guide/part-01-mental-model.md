<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 40-144 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part I — Read this first: the mental model

## 1. Cordis in one sentence

**Cordis is a runtime meta-framework that turns application capabilities into dynamically mountable components whose dependencies are tracked and whose in-process contributions have owned cleanup.**

In DeepSeek Harness, this becomes:

```text
DeepSeek Harness / dsh
        │
        │ domain semantics: agents, LLMs, tools, sessions, prompts, policies, UI
        ▼
Cordis
        │
        │ composition semantics: plugins, services, injection, effects, events,
        │ fibers, scopes, configuration, reconciliation, HMR
        ▼
Node.js / OS / external systems
```

The most important architectural statement in Harness is:

> **The product is a plugin tree.**

The LLM adapter is a plugin. The tool registry is a plugin. The agent loop is a plugin. Session storage is a plugin. Sandbox behavior is a plugin. UI/surface bundles are plugins and configuration layers.

Cordis itself does **not** know what an LLM, agent, chat, Bash command, or session means. That is why it is a **meta-framework** rather than an agent framework.

---

## 2. The five ideas to keep in working memory

When editing a Cordis system, reduce almost everything to these five ideas:

1. **Plugin = lifecycle unit.**
   A plugin is something Cordis can mount, suspend/reload, and dispose.

2. **Context = scoped capability environment.**
   `ctx` is how a plugin sees services and registers owned behavior.

3. **`inject` = live dependency contract.**
   It is not only startup DI. A consumer activates only while required service implementations exist. Provider identity changes can reactivate the consumer.

4. **Registration = effect = ownership.**
   If a plugin registers a listener, tool, provider, timer, watcher, or other contribution, that contribution must belong to the plugin's Fiber and have cleanup.

5. **`cordis.yml` = desired composition.**
   Configuration expresses the plugin tree. Stable entry IDs let Loader reconcile edits, provider swaps, configuration changes, and HMR without treating the whole process as disposable.

If a feature cannot be explained with these five ideas, inspect the owning subsystem before adding another abstraction.

---

## 3. The object model: do not confuse these terms

```text
Plugin definition
    │ ctx.plugin(plugin)
    ▼
Fiber                      ← one mounted runtime instance
    │ owns
    ├── child Context      ← scoped view of capabilities
    ├── effect disposers
    ├── dependency snapshot
    ├── child Fibers
    └── lifecycle state

Context
    ├── resolves Services by stable names
    ├── registers effects/listeners/plugins
    ├── dispatches typed Events
    ├── carries isolation/intercept scope
    └── exposes Registry + current Fiber

Service provider plugin
    └── provides ctx.<serviceName>

Consumer plugin
    └── injects <serviceName>
```

### Plugin
A **definition** or mountable callback/class/object. It may have zero, one, or many live Fibers.

### Fiber
A **runtime instance** of a plugin. The Fiber owns activation state and cleanup. A Fiber is not a thread, coroutine, React Fiber, or process.

### Context
The scoped interface passed into the plugin. It behaves like a dynamic service environment plus lifecycle-aware registration surface.

### Service
A named capability exposed on `ctx`, e.g. `ctx.tools`, `ctx.llm`, `ctx.sessions`, or a custom `ctx.myCap`.

### Registry
Tracks plugin runtimes and Fibers. Useful for introspection and diagnostics.

### Effect
A lifecycle-owned environmental contribution with a cleanup operation.

### Coeffect / `inject`
A declaration of contextual requirements. In Cordis, these requirements are reactive to live provider changes.

---
