# Cordis Interactive Tutorial

Watch a **real** [Cordis](https://github.com/deepseek-ai/deepseek-harness) plugin framework `Context` register plugins, resolve services, and dispatch events, live. Nothing here is simulated: a real `@deepseek-ai/cordis` root Context is instrumented so its own internal lifecycle events (`internal/plugin`, `internal/status`, `internal/service`, `internal/dispatch`) become a live WebSocket trace.

This is not just a tutorial. It's a working rehearsal of ACRYL's actual self-building capability: a real DeepSeek-backed coding agent, with file tools scoped to a sandboxed workspace, writes real Cordis plugin files and mounts them into the live Context via `mount_plugin` - the same call a real Loader makes. The agent gets back the real settled Fiber state (ACTIVE, or the real error on FAILED) and iterates against ground truth, not a guess. The canvas shows every plugin that's actually registered right now, which file it came from, and what it needs.

Modeled on [Agent Loop](https://github.com/inboxxobni/aicodingagent-ts) - the agent loop (streaming, tool execution, typed trace events), the provider adapter (DeepSeek's OpenAI-compatible chat API), and the file tools are ported directly from it, retargeted so the agent's tools build and activate Cordis plugins instead of arbitrary web apps.

A set of guided chapters (below) is also available for learning the primitives in isolation before turning the agent loose.

Recreates the official Cordis tutorial curriculum, then extends it with real ACRYL/Harness conventions:

**Part 1 - Cordis core** (chapters 1-7, all real, running plugin sets): your first plugin, lifecycle and effects, services, events, configuration (a real Standard Schema validator + the real `ValidationError`), composition and HMR (`fiber.update()`), into the harness (a minimal `ctx.tools` seam).

**Part 2 - ACRYL Harness basics** (chapters 8-10, real): the three plugin forms (function/object/class), `defineTool()` against an injected `tools` service, and plugin config the real ACRYL way - `@deepseek-ai/schemastery` (not the npm `zod` package; see chapter 10's own notes for how that got confirmed, not assumed).

**Part 3 - ACRYL's built-in services** (chapter 12, reference-only) and **Part 4 - practice** (chapter 13, real three-role capability design; chapters 11/14/15 reference-only - they document real conventions like package/install order and the `dsh-tool-cordis` vs Plugin Manager distinction, but need real DSH plumbing this sandbox doesn't pull in).

See `server/src/chapters/` for all fifteen.

## Run locally

Quick interactive run (foreground, Ctrl-C to stop):

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5174> (Vite falls back to the next free port if that one's taken - watch the terminal output for the actual URL).

### Managed run (background-friendly)

`scripts/server_*.sh` manage the full stack (server + web) as a single unit, with fixed, predictable ports instead of Vite's silent fallback:

```bash
scripts/server_start.sh          # foreground, Ctrl-C stops both
scripts/server_start_daemon.sh   # background; returns once both are healthy
scripts/server_status.sh         # what's actually running, on which port
scripts/server_restart.sh        # stop, then start_daemon
scripts/server_stop.sh           # stops only what these scripts started
```

Ports default to `8788` (server) and `5174` (web); override with `CORDIS_TUTORIAL_SERVER_PORT` / `CORDIS_TUTORIAL_WEB_PORT` if those collide with something else on your machine. `server_stop.sh` only kills processes it recorded starting (by process group, so it correctly reaps `pnpm` → `tsx watch` → `node` chains) - it never kills whatever else happens to be listening on a port, even if that port is still occupied afterward; it'll just tell you.

## Project layout

```text
shared/   CordisTraceEvent / ClientMessage contract shared by server and web
server/   The instrumented Cordis Context + the seven tutorial chapters
web/      React visualizer: plugin graph, live event trace, per-chapter theory
```

## Agent mode

Open Settings (top bar) and configure any of seven real providers - DeepSeek, OpenAI, Anthropic, Byteplus, Qwen, Ollama, or LM Studio, each with its own real model catalog and its own saved key (localStorage, per-provider) - then ask the agent to build something: "write a plugin that provides a greeter service, then mount it", or "write two plugins where one injects the other's service". The agent has five tools: `list_files`, `read_file`, `write_file`, `edit_file`, and `mount_plugin`.

Everything it writes lands in **one persistent, shared workspace directory** (`workspace/`, gitignored) - not a fresh sandbox per connection; every browser session/reload shares the same real files. `workspace/` is itself a real, standalone, portable Node project: it ships its own `package.json` (depending on the real `@deepseek-ai/cordis`, `@deepseek-ai/schemastery`, and `@deepseek-ai/dsh-host-webserver`) and `run.mjs`, a bootstrap that boots a real Cordis Context hosted the real DeepSeek Harness way (a `WebServer` Service, not an ad hoc keep-alive hack) and mounts every `*.mjs` plugin file it finds. Copy `workspace/` anywhere and `pnpm install && pnpm dev` runs it completely independent of this tutorial's own server.

Verify the core mechanic without any API key at all:

```bash
cd server && npx tsx scripts/verify-mount-plugin.mts
```

Drives `mount_plugin` directly against a real instrumented Context and a scratch workspace: mounts a plugin, checks `sourcePath` attribution and `pluginId` consistency, edits and re-mounts (confirms the old fiber gets disposed first), then mounts a deliberately broken plugin and confirms the real error surfaces rather than a generic failure.

## What's here

- **Live plugin canvas** - a CSS-animated graph of every plugin actually registered right now, its real Fiber state, and file provenance.
- **Workspace panel** - the real file tree, a real diff view against the session baseline, and a Monaco editor (real syntax highlighting, edit-and-save-to-disk, and "explain selection" - highlight any code and ask the agent about exactly that span).
- **Real terminal** - `xterm.js` backed by a real `node-pty` shell, `cwd`'d at the real workspace directory. `ls`, `pnpm install`, `node run.mjs` - genuinely runs, not simulated.
- **History / replay** - every live event is recorded automatically (no manual "save" step); past sessions are step-through replayable with a scrubbable timeline.
- **Archives and bundles, always paired** - "archive current" saves the real workspace files *and* their event history together as one server-side checkpoint (`.archives/`); "export/import bundle" does the same as one portable `.json` file you can move to another machine. Neither ever separates files from history - there is no reason to.
- **Clear workspace** - resets the real files back to the seeded starter state (with a confirm, and a nudge to archive/export first) - for starting a fresh teaching session.
- Per-chapter theory with tooltips, a live event trace log, and an internal-components source manifest (`/api/internal-components`).

Deferred: the Mermaid architecture diagram (edges between plugins currently show as "needs: serviceName" text on the node, not a drawn connection).

See [`docs/DEVELOPMENT-LOG.md`](docs/DEVELOPMENT-LOG.md) for how the project actually got here, including the real bugs found and fixed along the way.

## Checks

```bash
pnpm -r type-check
pnpm --filter @cordis-tutorial/web build
```
