# Development Log

Chronicles how this project actually got here - the real decisions, the real
bugs found and fixed, and why - so another coding agent picking this up
understands the reasoning behind non-obvious choices instead of re-deriving
or re-breaking them. This is the project's first commit, so entries below
predate commit history; from here on, follow the convention: commit the
change, then add its hash and explanation here as a separate documentation
checkpoint.

## 1. Core scaffold: a real, instrumented Cordis Context

`shared/` (event/message contract) + `server/` (Express + `ws`, one real
`@deepseek-ai/cordis` `Context` per session, instrumented by hooking
`internal/plugin`, `internal/status`, `internal/service`, `internal/dispatch`
into a typed `TraceEvent` stream) + `web/` (React + Zustand visualizer).
Chapters 1-7 recreate the official Cordis tutorial curriculum as real,
running plugin sets - not narrated, not simulated.

Real bugs found and fixed while building this:
- **`internal/plugin` fires twice per fiber** (creation and disposal, via
  Cordis's own `emitPluginDisposed()`) - looked like phantom
  re-registration. Fixed by checking `fiber.uid === null` and emitting
  `plugin_unmount` instead.
- **Stale `fiberId()` across disposal** - `fiber.uid` is nulled *before* the
  UNLOADING/DISPOSED status events fire, so a naive `fiberId()` produced a
  different id during teardown than during active life. Fixed with a
  `WeakMap<Fiber, string>` cache populated at first registration.
- **WebSocket race condition**: the server awaited `workspace.ensure()`
  before attaching `ws.on('message', ...)`, so a message sent immediately on
  the client's own `open` event could arrive with no listener yet and be
  silently dropped. Fixed by attaching the listener synchronously and
  buffering raw messages until setup completes.

## 2. Agent mode: a real coding agent, not a demo

The actual point of this project: a real DeepSeek-backed agent loop, ported
from [Agent Loop](https://github.com/inboxxobni/aicodingagent-ts) (streaming,
tool execution, typed trace events, the OpenAI-compatible provider adapter),
retargeted so its tools (`list_files`/`read_file`/`write_file`/`edit_file`)
build real Cordis plugin files and `mount_plugin` activates them in the same
live Context a chapter runs in - the same `ctx.plugin()` call a real Loader
makes. Verified end-to-end with a real API key: agent writes a file, mounts
it, Fiber genuinely reaches ACTIVE, a real `service_provide` fires.

## 3. Multi-provider settings, workspace file browser, history

Ported three more pieces from Agent Loop, each after an explicit correction
for reinventing a worse version the first time:
- **Multi-provider settings** (7 real providers, real model catalogs,
  per-provider localStorage) - first pass squeezed everything into a broken
  CSS layout; fixed by porting the reference's actual `.settings-*` CSS
  structure instead of guessing one.
- **Workspace file browser** - first pass was a flat file list; replaced
  with the reference's real `Workspace.tsx` shape (tabbed files/diff view,
  tree building, unified diff via the `diff` package).
- **History/replay** - first pass required a manual "save session" click;
  replaced with the reference's real pattern: every live event is recorded
  automatically into the current session, continuously, with step-through
  replay and a scrubbable timeline.

Also fixed: a hidden-modal "global navigator" (one click to discover it
existed) replaced with an always-visible sidebar, after direct, sharp
user feedback that it was undiscoverable.

## 4. Real on-disk archives, and the "no imports" persistence bug

`ArchiveStore` (ported from Agent Loop's own) bundles a session's real
workspace files **and** its paired event history together in one save - not
two separate flows. Later corrected again: history-only export/import (a
`.json` with events but no files) was confusing ("what do I choose - a
manifest file?"); replaced with a single `WorkspaceBundle` export/import that
always carries both, matching what "archive current" already did server-side.

## 5. The workspace-proliferation bug (found from a screenshot)

Each session originally got a fresh `.workspaces/<random-uuid>/` directory.
Every page reload - including ones from automated testing - left another
one behind; a Finder screenshot showing 8 near-empty folders is what
surfaced it. Root cause: no session-id reuse across reconnects. Fixed by
switching to **one persistent, shared `workspace/` directory** for the
whole server (matching Agent Loop's own `const workspace = new
Workspace(workspaceRoot)`, module-scoped, created once) - not per-connection
sandboxes. The old `.workspaces/` directory was deleted once confirmed dead.

A related Cordis-Context-per-connection leak (nothing disposed the root
Context on `ws.on('close')`) was identified but is not yet fixed - flagged
here for whoever picks it up next.

## 6. `server_*.sh`: full-stack process management

Zombie process confusion (`server_stop.sh` killing multiple PIDs, "why does
`pnpm dev` say the port is taken") led to `scripts/lib.sh` +
`scripts/server_{start,start_daemon,stop,status,restart}.sh`: process-GROUP
kill (a single PID kill does not reliably reach the `pnpm` → `tsx watch` →
`node` fork chain), `--strictPort` on the Vite dev server (a silently-shifted
port is exactly what made debugging confusing), and status reporting that
distinguishes "our tracked process is on this port" from "something
unrelated is squatting on it." Ports are configurable via
`CORDIS_TUTORIAL_SERVER_PORT` / `CORDIS_TUTORIAL_WEB_PORT`, read by both the
scripts and `web/vite.config.ts`'s dev proxy, so they can never disagree.

(A duplicate, inferior set of root-level `server_*.sh` scripts was written
later in the same session, apparently without checking whether this system
already existed. Deleted once discovered - `scripts/` is the one true
implementation.)

## 7. ACRYL Harness chapters (8-15), and a fact that was backwards

Extended past bare Cordis into real ACRYL/Harness conventions: the three
plugin forms, `defineTool()` against an injected `tools` service (matching
`runtime/acryl-harness-runtime/src/plugin-acryl-workspace-status.ts`'s real
shape), a three-role capability design chapter mirroring ACRYL's real
`acrAgentControl` split.

Chapter 10 (plugin config) went through the same claim twice, **backwards
both times**: first pass said "ACRYL uses zod, not Schemastery" - actually
backwards, because `apps/acryl-desktop/src/updates.ts` imports
`@deepseek-ai/schemastery` *aliased as* `z`, which reads exactly like the
npm `zod` package but isn't (a grep of the whole ACRYL repo turns up zero
real `from 'zod'` imports). Fixed in both this tutorial and the
`cordis-plugin-quickstart` skill in the ACRYL repo itself, since that skill
actively guides real plugin authoring.

## 8. Monaco editor, and the squeezed-sidebar lesson (twice)

Added `@monaco-editor/react` for real syntax highlighting, in-place editing
(`save_file` WS message, round-tripped to a real disk write), and
select-to-explain (highlight any span, ask the agent about exactly that
text). Two real bugs found by testing, not assumed away:
- **Stale content on file switch** - `<CodeEditor>` kept the same component
  instance across files and tried to manually reset its draft state on prop
  change; the reset could be skipped when a coincidental value match made
  the guard condition false. Fixed by keying the editor per-file
  (`key={path}`) so switching files fully remounts it instead of patching
  state across files.
- **UX**: first pass embedded Monaco directly in the 340px workspace
  sidebar - lines truncated mid-word. Fixed by moving the editor into a
  large centered overlay (reusing the Settings panel's own overlay pattern)
  that only opens on an explicit file click, after a second bug where it
  auto-popped open on every connect because it was wired to the same
  `openFile` state the diff tab uses for selection.

## 9. A standalone, portable `workspace/`

The generated plugin files had no host - `mount_plugin` only worked inside
this tutorial's own server. Seeded a real `package.json` +  `run.mjs` into
`workspace/` so it's a genuine standalone Node project: `pnpm install &&
pnpm dev` anywhere boots a real Cordis Context and mounts every `*.mjs` file
found. First pass used a bare `await new Promise(() => {})` keep-alive
hack; corrected after research into how DeepSeek Harness itself hosts a
web-facing Context - `@deepseek-ai/dsh-host-webserver`'s `WebServer`
Service (a thin, real `node:http` wrapper: `register()`/`registerFallback()`,
no Express). Verified end-to-end in a directory outside this repo entirely:
real install, real plugin mounts with real dependency-ordered activation,
`curl /healthz` → `ok`.

## 10. A real terminal, and a packaging bug that crashes the whole server

`xterm.js` + a real `node-pty` shell per session (`cwd`'d at the real
workspace directory) - `ls`, `pnpm install`, `node run.mjs`, genuinely run,
not simulated. Two real bugs:
- **Connect race** (the same class as #1's WebSocket bug): the terminal
  tried to start before the socket was open, so `terminal_start` silently
  dropped. Fixed by re-firing once `connected` actually flips true.
- **`posix_spawnp failed`, crashing the entire server process**: npm/pnpm's
  tarball extraction strips the executable bit from node-pty's bundled
  `spawn-helper` binary (a known packaging quirk). A one-off `chmod +x`
  fixes it locally but doesn't survive a fresh `pnpm install` anywhere else
  - fixed durably with a `postinstall` script
  (`server/scripts/fix-node-pty-permissions.mjs`) that re-applies it every
  install.

## 11. Clear workspace, for starting a fresh teaching session

A one-click "clear workspace" button (topbar, with a confirm) resets the
real files back to the seeded starter state and starts a fresh recorded
session, without losing the old one (it's still in History; archive or
export its bundle first if the real files matter). The server's
`workspace_reset` event carries fresh content inline, not just a file list,
so the client drops every stale `fileContents`/`baselineContents` entry in
one step instead of accumulating ghosts of deleted files.
