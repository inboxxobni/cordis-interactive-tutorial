# Workspace Summary

This project is a **Cordis plugin workspace / sandbox** for experimenting with
`@deepseek-ai/cordis` plugins and their lifecycle (services, effects, events,
Fiber states). It is designed to be mounted by the tutorial harness via
`mount_plugin`, but it can also run standalone as a real Node project.

## What it does

- `run.mjs` boots a real `@deepseek-ai/cordis` Context and hosts it with
  `@deepseek-ai/dsh-host-webserver` on `http://127.0.0.1:8790` (with a
  `/healthz` endpoint).
- It automatically mounts every `*.mjs` plugin file in the directory (except
  `run.mjs`) into the Context, the same way the tutorial server does.
- The plugin files demonstrate Cordis concepts such as service provisioning,
  injection, effects/cleanup, events, and class-based services.

## File overview

- `README.md` — explains the sandbox and how to run it with `pnpm dev` / `npm run dev`.
- `package.json` — declares dependencies (`@deepseek-ai/cordis`,
  `@deepseek-ai/schemastery`, `@deepseek-ai/dsh-host-webserver`) and scripts.
- `run.mjs` — standalone host that starts the Context, mounts all plugin files,
  and handles graceful shutdown.
- `hello-plugin.mjs` — minimal starter plugin that logs when active.
- `greeter.mjs` — provides a `greeter` service on the Context.
- `greeter-consumer.mjs` — consumes the `greeter` service and logs greetings.
- `greeter-reporter.mjs` — another `greeter` consumer that logs salutation and
  greets a configurable audience.
- `env-probe.mjs` — placeholder plugin with no behavior yet.
- `context-window.mjs` — provides a `contextWindow` service with simple token
  estimation and shared-prefix helpers.
- `compaction.mjs` — listens for `agent-harness/compact` events and compacts
  long message histories into a summary.
- `llm.mjs` — provides an `llm` service that calls an OpenAI-compatible
  `chat/completions` endpoint using env vars.
- `tools.mjs` — provides a `tools` service with file tools (`list_files`,
  `read_file`, `write_file`, `edit_file`) scoped safely to the workspace.
- `agent-loop.mjs` — class-based service that runs an LLM agent loop, combining
  `llm`, `tools`, and `systemPrompt`.
- `system-prompt.mjs` — assembles a system prompt from the directory listing and
  available tool definitions.
