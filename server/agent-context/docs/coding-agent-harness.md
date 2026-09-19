# Building the coding-agent harness out of Cordis plugins

Goal: a real, working coding agent in this workspace, one service per plugin
file. Read `docs/this-sandbox.md` and `docs/guide/part-13-hands-on-mini-system.md`
first; the working reference implementation is `examples/coding-agent/`.

## Services and dependency order

```text
tools -> contextWindow -> compaction -> systemPrompt -> llm
```

| File | Provides | inject |
|---|---|---|
| `tools.mjs` | `tools` (`definitions`, `execute(name, input)`) | none |
| `context-window.mjs` | `contextWindow` (`estimateTokens`, `sharedPrefixLength`) | none |
| `compaction.mjs` | `compaction`; listens for `agent-harness/compact` | `contextWindow` |
| `system-prompt.mjs` | `systemPrompt` (`assemble()`) | `tools` |
| `llm.mjs` | `llm` (`chat(messages, tools)`) | none |
| `agent-loop.mjs` | `agentLoop` (`runTurn(task)`) | `tools`, `llm`, `systemPrompt` |

`agentLoop` correctly stays **PENDING** until `tools`, `llm` and `systemPrompt`
all exist. It flips to ACTIVE by itself when the last one is provided,
regardless of mount order. That flip is the proof the wiring is right.

## Conventions

See `docs/this-sandbox.md`: resolve paths from `import.meta.url`, read LLM
credentials from `process.env.CORDIS_AGENT_*`, never write a key to a file.

## Running it standalone

`run.mjs` + `pnpm-workspace.yaml` in this directory make it a standalone project:
`pnpm install && pnpm dev`. Document how to drive a turn in an `AGENT.md` you write.
