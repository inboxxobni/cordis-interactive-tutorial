# Agent-harness plugin workspace — summary

This directory is a portable Cordis plugin sandbox. Each `*.mjs` file is a real
Cordis plugin (a module exporting `name` and `apply`) that the host passes a live
`ctx` into. A plugin never imports Cordis itself — only the host (`run.mjs`, or the
tutorial's server) creates the `Context`. Plugins provide and inject named
**services**; Cordis resolves them by name, so mount order is irrelevant.

`run.mjs` is the **host/runner**, not a plugin: it creates a real
`@deepseek-ai/cordis` Context, hosts it with `@deepseek-ai/dsh-host-webserver` on
`127.0.0.1:8790` (with a `/healthz` route), then imports and mounts every other
`*.mjs` file in this directory, waits for the batch to settle, and prints each
Fiber's final state. The workspace root used by the tools/prompt is derived from
each plugin file's own URL, never the process cwd.

## Product plugins (the coding-agent harness)

| File | Provides (service) | Injects | Role |
| --- | --- | --- | --- |
| `tools.mjs` | `tools` (`ctx.tools.definitions`, `ctx.tools.execute(name, input)`) | — (leaf) | Tool registry: four real `node:fs/promises` tools (`list_files`, `read_file`, `write_file`, `edit_file`) rooted at this directory, with a path guard that refuses to escape the workspace. |
| `llm.mjs` | `llm` (`await ctx.llm.chat(messages, tools)`) | — (leaf) | The model adapter and the only plugin that talks to the network. Speaks OpenAI-compatible and Anthropic wire formats and normalizes both back to an OpenAI-shaped assistant message `{ role, content, tool_calls }`. Reads credentials only from the environment; never prints the key. |
| `context-window.mjs` | `contextWindow` (`estimateTokens`, `sharedPrefixLength`) | — (leaf) | Cheap, approximate token-budget service (chars/4). `sharedPrefixLength` finds the identical leading run between two transcripts for compaction/prompt-cache reuse. No timers/listeners, so nothing outlives `apply()`. |
| `system-prompt.mjs` | `systemPrompt` (`await ctx.systemPrompt.assemble({ task })`) | `tools` | Context assembler. Builds the system prompt from the LIVE environment: the tool list comes from `ctx.tools.definitions` and the file list from a real `readdir`, so the prompt can never describe a capability or file that no longer exists. |
| `compaction.mjs` | `compaction` (a `Service` identity, so consumers can inject it by name) | `contextWindow` | Context-budget enforcement. Registers a listener (via `ctx.on`, an auto-removed effect of its Fiber) on the **serial** event `agent-harness/compact`; when estimated tokens cross a threshold it returns a shortened transcript (keeps leading system messages, summarizes dropped ones, keeps the newest N), otherwise returns `undefined` to decline. |
| `agent-loop.mjs` | `agentLoop` (`ctx.agentLoop.runTurn(task)`) | `tools`, `llm`, `systemPrompt` | The turn driver. One turn = model ⇄ tools cycle (up to `MAX_STEPS` = 10) until the model stops requesting tools. Assembles the prompt, calls `ctx.llm.chat`, executes each tool call via `ctx.tools.execute`, and feeds results back as `tool` messages. Stays `PENDING` until all three dependencies appear, then self-activates. |
| `hello-plugin.mjs` | — | — | Starter/scaffold: a minimal mountable plugin that only logs `[hello-plugin] active`. Provides and injects nothing. |

## Probe / self-test plugins (diagnostics, not product code)

| File | Provides | Injects | Purpose |
| --- | --- | --- | --- |
| `api-probe.mjs` | — | — | Diagnostic: logs provider/model/base/key-presence from the environment without printing the key. |
| `ref-probe.mjs` | — | — | Retired no-op, kept so its canvas node doesn't sit in FAILED. Owns no effects. |
| `compact-selftest.mjs` | — | `compaction`, `contextWindow` | Drives the serial `agent-harness/compact` event twice (over threshold → array, under → `undefined`) and reports by throwing on failure; PASS only if both branches behaved. |
| `llm-selftest.mjs` | — | `llm` | One real round-trip through `ctx.llm.chat()` to prove the adapter works and normalizes the reply shape `agent-loop.mjs` expects. |
| `prompt-selftest.mjs` | — | `systemPrompt`, `tools` | Proves `assemble()` is derived from the live environment: every tool name and the file list are actually present in the prompt. |

## Dependency graph (who injects whom)

```
tools ─────────┐
llm ───────────┼──► agent-loop ──► provides agentLoop
system-prompt ─┘        ▲
   ▲                    │ injects tools, llm, systemPrompt
   │ injects tools      │
context-window ──► compaction   (compaction also listens on the
                    serial event 'agent-harness/compact')
```

- **Leaves (no dependencies, ACTIVE on mount):** `tools`, `llm`, `context-window`,
  `hello-plugin`, `api-probe`, `ref-probe`.
- **`system-prompt`** depends on `tools` (it reads the live tool definitions and
  the workspace listing).
- **`compaction`** depends on `contextWindow` and exposes a serial-event listener,
  so it acts as a budget-enforcement hook other code can call.
- **`agent-loop`** sits at the top: it injects `tools`, `llm`, and `systemPrompt`
  together — it is `PENDING` until all three are provided, then flips to `ACTIVE`
  on its own.
- The **selftests** each inject the services they exercise (`compaction` +
  `contextWindow`; `llm`; `systemPrompt` + `tools`) and report PASS by logging /
  FAIL by throwing.

## How they depend on each other

`tools` → (`system-prompt`) → `agent-loop` is the main chain: the tool registry
feeds the prompt assembler, and both the registry and the assembler feed the loop.
`llm` is the loop's other required leaf. `context-window` feeds `compaction`,
which is a separate, event-driven budget layer rather than a hard dependency of the
loop. Because Cordis resolves services by name, any file can mount in any order;
the loop and the selftests simply stay `PENDING` until their named dependencies
exist.
