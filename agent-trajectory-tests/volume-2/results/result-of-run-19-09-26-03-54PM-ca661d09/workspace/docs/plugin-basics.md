# Plugin basics

A plugin is a module exporting `apply(ctx, config)`, optionally `name`
and `inject` (an array of required service names). Cordis calls
apply() once the plugin's Fiber reaches ACTIVE - never before.

## Fiber lifecycle

- PENDING: a declared `inject` name is not yet provided by anything
  mounted - this is healthy, not broken. It flips to ACTIVE the
  moment something in this same Context calls `ctx.provide(thatName,
  ...)`, however that happens to be mounted.
- ACTIVE: apply() has run. `ctx.provide()` calls inside it are live.
- FAILED: apply() threw. The error is real - read it, fix the actual
  bug, do not just retry the same file unchanged.

See `docs/verifying-your-work.md` for how to confirm which of these
is real right now, instead of assuming from what you wrote.

## Services: provide/inject

One plugin exposes a capability with `ctx.provide(name, value)`;
another requires it with `export const inject = [name]`. Multiple
plugins in this workspace can inject each other's services -
mount order does not matter, only which services actually resolve.

## Effects

Anything that outlives one apply() call (a timer, a subscription)
must be acquired inside `ctx.effect(() => { ...; return () =>
cleanup() })` so Cordis can tear it down on dispose/re-mount.

## Minimal example

See `hello-plugin.mjs` in this directory for a real, mountable
instance of this exact shape.

## Your iteration loop

write_file (or edit_file) a plugin, then mount_plugin it. Re-mounting
the same path automatically disposes the old fiber first, so
edit -> mount_plugin is your whole cycle - no separate "restart" step.
