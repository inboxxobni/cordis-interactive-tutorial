# AGENT.md - the coding agent in this workspace

This directory is a complete, working coding agent built entirely out of
Cordis plugins. Six files provide it; `run.mjs` is the standalone host that
mounts them all.

| File | Provides | Injects |
|---|---|---|
| `tools.mjs` | `tools` | (nothing) |
| `context-window.mjs` | `contextWindow` | (nothing) |
| `compaction.mjs` | `compaction` | `contextWindow` |
| `system-prompt.mjs` | `systemPrompt` | `tools` |
| `llm.mjs` | `llm` | (nothing) |
| `agent-loop.mjs` | `agentLoop` | `tools`, `llm`, `systemPrompt` |

## The real inject chain

Cordis resolves this by service name, not by mount order: a plugin whose
`inject` list is unmet stays PENDING (healthy), and flips to ACTIVE on its
own the moment the last service it needs is provided.

```text
tools ──────────────┐
                    ├──> systemPrompt ──┐
llm ────────────────┼───────────────────┼──> agentLoop
                    └───────────────────┘
contextWindow ──> compaction
```

- `agentLoop` needs `tools` + `llm` + `systemPrompt`.
- `systemPrompt` needs `tools` (it renders the live tool list).
- `compaction` needs `contextWindow` (it measures with it).
- `tools`, `llm`, `contextWindow` need nothing and are ACTIVE on mount.

Practical consequence: mount order does not matter. In this workspace
`agent-loop.mjs` sat PENDING with only `llm` missing, and went ACTIVE by
itself when `llm.mjs` was mounted - no re-mount of the loop.

## What `agentLoop.runTurn(task)` does

`ctx.agentLoop.runTurn(task)` runs exactly one turn and returns a trace:

1. Builds the system prompt: `await ctx.systemPrompt.assemble({ task })` - the
   live tool definitions plus a fresh `readdir` of this directory, so the
   prompt never describes stale state. Pushed as the first `system` message.
2. Pushes `task` as a `user` message.
3. Loops up to `MAX_STEPS = 10`:
   - `reply = await ctx.llm.chat(messages, ctx.tools.definitions)`
   - appends `reply` to the transcript;
   - if `reply.tool_calls` is empty, stops and returns;
   - otherwise, for each call: `await ctx.tools.execute(name, input)` (string
     arguments are `JSON.parse`d; a throwing tool becomes `{ error }` rather
     than killing the turn), records a step, and appends a `role: 'tool'`
     message carrying the result and the matching `tool_call_id`.
4. Returns `{ messages, steps, final, done }` - `done: true` when the model
   replied without tool calls, `done: false` with `reason: 'hit MAX_STEPS
   (10)'` if the budget ran out.

The four real tools are `list_files`, `read_file`, `write_file`, `edit_file`.
All paths resolve against this directory (from the plugin file's own URL,
never the process cwd) and are refused if they escape it.

## Running it standalone

```sh
pnpm install     # or: npm install
pnpm dev         # or: npm run dev
```

`run.mjs` boots a real `@deepseek-ai/cordis` Context, hosts it with
`@deepseek-ai/dsh-host-webserver` on http://127.0.0.1:8790 (`/healthz`), and
mounts **every** `*.mjs` file in this directory - the same activation the
tutorial UI performs via `mount_plugin`.

### Driving one turn

`run.mjs` intentionally has no task endpoint, so a turn is driven by
`drive-turn.mjs`, which injects `agentLoop` and calls `runTurn`:

```sh
CORDIS_AGENT_TASK='List the files in this workspace and summarize it in three lines.' pnpm dev
```

It prints each tool step and the final answer, then the host keeps serving
until Ctrl+C. Without `CORDIS_AGENT_TASK` it stays inert and just logs a hint.

In the visualizer the same file is driven by mount config instead:

```text
mount_plugin('drive-turn.mjs', { task: 'List the files in this workspace.' })
```

Beware when running standalone: `run.mjs` mounts *all* `*.mjs` files, so the
`check-*.mjs` verification plugins also execute (and the agent-loop check makes
a real LLM call). Delete them for a quiet boot.

## Environment variables `llm.mjs` reads

Credentials come only from the environment - never from a file, never asked
for, never logged (`apply()` prints presence, not value).

| Variable | Required | Purpose |
|---|---|---|
| `CORDIS_AGENT_PROVIDER` | no (default `openai`) | `openai`/`deepseek` (OpenAI-compatible wire format) or `anthropic` (Messages API) |
| `CORDIS_AGENT_MODEL` | **yes** | model id; alias accepted: `CORDIS_AGENT_MODEL_NAME` |
| `CORDIS_AGENT_API_KEY` | **yes** | bearer key; aliases: `CORDIS_AGENT_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY` |
| `CORDIS_AGENT_BASE_URL` | no | API root, no trailing slash; alias `CORDIS_AGENT_BASE`; else provider default (`api.openai.com/v1`, `api.deepseek.com/v1`, `api.anthropic.com/v1`) |
| `CORDIS_AGENT_MAX_TOKENS` | no (default 4096) | max output tokens |
| `CORDIS_AGENT_TIMEOUT_MS` | no (default 180000) | per-request timeout |
| `CORDIS_AGENT_ANTHROPIC_VERSION` | no (default `2023-06-01`) | only for the Anthropic provider |
| `CORDIS_AGENT_TASK` | no | task for `drive-turn.mjs` standalone |

`chat()` throws a clear error if the model or key is missing, and on non-2xx
or non-JSON responses (`status` + truncated body). For `anthropic` it
translates both directions: system hoisted out of the message list, tool
results grouped into `tool_result` user blocks, assistant tool calls as
`tool_use` blocks, and responses converted back to the OpenAI-shaped
assistant message (`name` + JSON-string `arguments`) the loop already speaks.

## Status of the two context services

Real and mounted, but **not yet wired into the loop**, and worth knowing:

- `compaction` provides its service and listens on the `agent-harness/compact`
  event (over ~6000 estimated tokens it returns a shortened array: leading
  system message(s) kept, the older middle replaced by one `[compaction] ...`
  summary message, newest 6 kept verbatim). `runTurn` does **not** call it or
  emit that event yet - nothing compacts during a turn today.
- `contextWindow` provides `estimateTokens(messages)` (chars/4) and
  `sharedPrefixLength(previous, current)`. `runTurn` does not consult it yet;
  `compaction` uses the former.

Closing that gap - having the loop check the budget each step and compact
when it crosses the threshold - is the next real piece of work.
