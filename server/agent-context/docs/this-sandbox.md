# This sandbox: how it differs from real ACRYL/DSH composition

Read this first. The handbook (`docs/guide/`) and cheatsheet describe real
ACRYL / DeepSeek Harness, where plugins are composed through `cordis.yml`,
bundles and profiles. **This sandbox does not use any of that.** Here a plugin
is a file in this directory that you mount into one live Cordis `Context`
yourself.

## What you have

| Tool | What it does |
|---|---|
| `list_files`, `read_file`, `write_file`, `edit_file` | Work on files in this workspace only (relative paths). |
| `mount_plugin` | `import()`s a workspace file and mounts it with `ctx.plugin(module, config)` in the live Context. Returns the real settled Fiber state (ACTIVE / PENDING / FAILED). Re-mounting the same path disposes the old fiber first. |
| `cordis_inspect_list`, `cordis_inspect_query` | Read-only: every fiber really mounted now with its real state, and one fiber's real inject list and which services actually resolve. |
| `run_workspace_agent_turn` | Only meaningful once you have built and mounted an `agentLoop` service: runs one real turn through it. |

## Plugin file shape `mount_plugin` accepts

`mount_plugin` hands the module's **exports** to `ctx.plugin()`, so a plugin file
uses **named exports** (the same contract as real Cordis/Harness):

```js
export const name = 'my-plugin'        // stable id
export const inject = ['tools']        // hard dependencies (optional)
export const Config = /* schema */     // optional, validated before apply()
export function apply(ctx, config) {}  // required
```

- **`export default` is NOT a plugin form** and is rejected
  ("invalid plugin, expect function or object with an apply method").
- **Service class form**: define `class X extends Service { constructor(ctx) { super(ctx, 'serviceName') } }`
  and export it as `apply`: `export { X as apply }`. Import `Service` from
  `@deepseek-ai/cordis` (installed in this workspace). Declare hard dependencies
  with `export const inject = [...]`.
- A module's exports ARE the "object form"; there is no separate one to write.

Working, verified copies of each pattern are in `examples/` (see `examples/README.md`).
`@deepseek-ai/cordis` and `@deepseek-ai/schemastery` are importable from files here.

## What does NOT apply here

`cordis.yml`, bundles, profiles, patches, the Loader, `!!js` config. Skip the
handbook parts marked `acryl-only` in `docs/docs.json` (Part 9, Part 15, Part 24,
`docs/acryl/`). Everything about Context, Fibers, effects, services, events,
config schemas and tools applies unchanged.

## Conventions every plugin here follows

- **Paths**: resolve relative to the plugin file, never the server's cwd:
  `const dir = path.dirname(fileURLToPath(import.meta.url))`. This also keeps the
  file working when this workspace is copied elsewhere and run with `pnpm dev`.
- **Credentials**: read `process.env.CORDIS_AGENT_PROVIDER`, `_MODEL`, `_API_KEY`,
  `_BASE_URL`. They are already set from the user's Settings. Never ask for a key
  and never write one into a file.
- **Anything that outlives `apply()`** (timer, listener, subscription) is acquired
  inside `ctx.effect()` and returns its disposer. See `docs/guide/part-05-effects.md`.
- **PENDING is healthy.** It means a declared `inject` is not provided yet.
  Do not "fix" it by removing the `inject`; provide the service.

## The loop

1. Read the doc for your topic (`docs/README.md`), then the closest example in `examples/`.
2. `write_file` your plugin, `mount_plugin` it, read the real Fiber state.
3. Confirm with `cordis_inspect_list` -> `cordis_inspect_query`. Never claim
   success or state a Fiber state from memory. See `docs/verifying-your-work.md`.
