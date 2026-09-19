# AGENT.md - the coding agent in this workspace

This directory is a complete, working coding agent built entirely out of Cordis
plugins. Six files provide it; `run.mjs` is the standalone host.

| File | Provides (service) | Injects |
|---|---|---|
| `tools.mjs` | `tools` | — |
| `context-window.mjs` | `contextWindow` | — |
| `compaction.mjs` | `compaction` | `contextWindow` |
| `system-prompt.mjs` | `systemPrompt` | `tools` |
| `llm.mjs` | `llm` | — |
| `agent-loop.mjs` | `agentLoop` | `tools`, `llm`, `systemPrompt` |

## What `agentLoop.runTurn(task)` does

`ctx.agentLoop.runTurn(task)` runs exactly **one turn** and returns a trace
`{ messages, steps, final, done, stepsUsed }`:

1. **Assemble the system prompt** - `await ctx.systemPrompt.assemble({ task })`.
   The tool list comes from `ctx.tools.definitions` and the file list from a real
   `readdir`, so the prompt can never describe capabilities or files that no
   longer exist. Pushed as the first `system` message.
2. **Push `task`** as a `user` message.
3. **Loop, up to `MAX_STEPS = 10`:**
   - `reply = await ctx.llm.chat(messages, ctx.tools.definitions)`
   - append `reply` (an OpenAI-shaped assistant message) to the transcript;
   - if `reply.tool_calls` is empty → **stop** and return with `done: true`;
   - otherwise run **each** call via `ctx.tools.execute(name, input)` and append
     one `tool` message per result (`tool_call_id`, `name`, string content),
     then loop again.
4. If the budget runs out, return `done: false` with
   `reason: "hit MAX_STEPS (10)"`.

A tool that throws does **not** crash the turn: the error text is caught and fed
back to the model as that tool's result, so the model can react to it.

This feedback step - tool results going back into the transcript and driving the
next model call - is the whole difference between this and a chat UI.

## The real inject chain

Cordis resolves dependencies **by service name, not by mount order**. A plugin
whose `inject` list is unmet stays `PENDING` (healthy); it flips to `ACTIVE` on
its own the moment the last service it needs is provided, with no re-mount.

```text
tools ──────────────┐
                    │
llm ────────────────┼──► agentLoop
                    │    (injects tools, llm, systemPrompt)
systemPrompt ───────┘
   ▲
   │ injects tools
   │
contextWindow ──► compaction   (injects contextWindow;
                               also listens on 'agent-harness/compact')
```

- `agentLoop` needs **all three** of `tools`, `llm`, `systemPrompt`.
- `systemPrompt` needs `tools` (it renders the live tool list).
- `compaction` needs `contextWindow` (it measures with it).
- `tools`, `llm`, `contextWindow` need nothing and are `ACTIVE` on mount.

Observed in practice: `agent-loop.mjs` sat `PENDING` for three successive mounts
while `llm` was the only service missing, then went `ACTIVE` by itself the moment
`llm.mjs` was mounted - `agent-loop.mjs` was never re-mounted.

## Run it standalone

```bash
pnpm install
pnpm dev          # = node run.mjs
```

`run.mjs` creates a real Cordis `Context`, hosts it on
`http://127.0.0.1:8790` (with a `/healthz` route), then imports and mounts every
`*.mjs` in this directory (excluding itself) and prints each Fiber's final state.

Two operational notes about `pnpm dev`:

- **It does not run a turn.** Mounting an `agentLoop` provides the service; it
  does not call it. `run.mjs` stops at mounting and serving `/healthz`. To
  actually drive a turn, use the driver below.
- **It mounts the self-test and probe files too** (`llm-selftest.mjs`,
  `prompt-selftest.mjs`, `compact-selftest.mjs`, `api-probe.mjs`,
  `ref-probe.mjs`), because they match the same `*.mjs` glob. `llm-selftest.mjs`
  makes **one real API call** at mount time. Delete or rename them if you do not
  want that on every boot.

### Driving a turn

`drive-turn.js` is a host script (`.js`, deliberately, so `run.mjs`'s `*.mjs`
glob does not try to mount it as a plugin). It mounts the six product plugins in
dependency order and calls `runTurn`:

```bash
node drive-turn.js "list the files here and summarize them"
# or
CORDIS_AGENT_TASK="read README.md and summarize it" node drive-turn.js
```

It prints each tool call as it happens, then the final answer, then
`done` / `steps` / `toolCalls`.

To drive a turn from your own code:

```js
import { Context } from '@deepseek-ai/cordis'
const ctx = new Context()
await ctx.plugin(toolsModule, {})
await ctx.plugin(llmModule, {})
await ctx.plugin(systemPromptModule, {})
await ctx.plugin(agentLoopModule, {})   // ACTIVE once the three above exist

const trace = await ctx.agentLoop.runTurn('your task')
console.log(trace.final.content)
```

## Environment variables `llm.mjs` needs

Credentials are read **only** from the environment - never from a config file,
never written to disk, never logged (only whether a key is present is printed).

| Variable | Required | Meaning / aliases |
|---|---|---|
| `CORDIS_AGENT_PROVIDER` | no (default `openai`) | Selects the wire format: `anthropic` → `POST {base}/messages`; anything else (incl. `deepseek`) → `POST {base}/chat/completions`. |
| `CORDIS_AGENT_MODEL` | **yes** | Model id. Alias: `CORDIS_AGENT_MODEL_NAME`. Empty ⇒ `chat()` throws `llm: no model configured (CORDIS_AGENT_MODEL is empty)`. |
| `CORDIS_AGENT_API_KEY` | **yes** | Bearer key. Aliases: `CORDIS_AGENT_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`. Empty ⇒ `chat()` throws `llm: no API key in the environment (CORDIS_AGENT_API_KEY is empty)`. |
| `CORDIS_AGENT_BASE_URL` | no | API root, no trailing slash. Alias: `CORDIS_AGENT_BASE`. Otherwise the provider default (`api.openai.com/v1`, `api.deepseek.com/v1`, `api.anthropic.com/v1`). |
| `CORDIS_AGENT_MAX_TOKENS` | no (default `4096`) | Max output tokens. |
| `CORDIS_AGENT_TIMEOUT_MS` | no (default `180000`) | Per-request timeout (`AbortSignal.timeout`). |
| `CORDIS_AGENT_ANTHROPIC_VERSION` | no (default `2023-06-01`) | Only used when `CORDIS_AGENT_PROVIDER=anthropic`. |
| `CORDIS_AGENT_TASK` | no | Task for `drive-turn.js` when no CLI argument is given. |

Both wire formats are normalized to the same OpenAI-shaped assistant message
(`{ role, content, tool_calls }`) that `runTurn` drives; for Anthropic,
`tool_use` blocks become `tool_calls` with JSON-string `arguments`.

## Status: compaction is wired but not used

Worth knowing before you extend this:

- `context-window.mjs` and `compaction.mjs` are real and mounted, and
  `compaction` correctly answers the `agent-harness/compact` **serial** event.
- **`runTurn` does not use them yet.** It never calls
  `contextWindow.estimateTokens` and never dispatches that event, so nothing
  compacts during a real turn and `sharedPrefixLength` has no caller.

Closing that gap - having the loop check the budget each step and dispatch
`agent-harness/compact` (via `ctx.serial`, so the first non-`undefined` result
wins) - is the next real piece of work.
