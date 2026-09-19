# Building the coding-agent harness (Volume 2)

This curriculum has you build a real, working coding agent entirely
out of Cordis plugins, in this same workspace - one service at a
time, in this exact dependency order:

```text
tools -> contextWindow -> compaction -> systemPrompt -> llm
```

with an `agentLoop` Service (`static inject = ['tools', 'llm',
'systemPrompt']`) that stays PENDING until all three of those exist -
see `docs/plugin-basics.md` for why that is the correct, healthy
state, not a bug to work around.

A plugin file mounted via mount_plugin runs as a real ES module in
this same Node process - full access to Node builtins, no special
helper object beyond `ctx`. Two conventions every such plugin needs,
matching what this workspace's own `run.mjs` already does for real:

- Resolve paths relative to the PLUGIN FILE, not the server's cwd:
  `const dir = path.dirname(fileURLToPath(import.meta.url))`, then
  build paths under `dir` - this also makes the file work unmodified
  once the workspace is copied elsewhere and run standalone (see
  `run.mjs` and `pnpm-workspace.yaml` in this directory).
- Read LLM credentials from `process.env.CORDIS_AGENT_PROVIDER` /
  `_MODEL` / `_API_KEY` / `_BASE_URL` - already set from whatever is
  configured in Settings. Never ask the user for the key and never
  write it into a file; read it from the environment only.
