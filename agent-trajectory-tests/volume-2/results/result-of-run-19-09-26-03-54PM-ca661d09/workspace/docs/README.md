# Cordis architecture docs

Read the file for your current topic before implementing - do not
guess from memory of a similar plugin. Follow any `see docs/...`
cross-reference before writing code.

| Topic | File |
|---|---|
| Plugin shape, provide/inject, Fiber lifecycle, ctx.effect | `docs/plugin-basics.md` |
| The coding-agent-harness build (tools/llm/contextWindow/compaction/systemPrompt/agentLoop) | `docs/coding-agent-harness.md` |
| How to confirm a plugin really works, before claiming it does | `docs/verifying-your-work.md` |

Real, mountable example of the shape `docs/plugin-basics.md` describes:
`hello-plugin.mjs` in this same directory.
