# Cordis plugin workspace

This is your sandbox. Write real Cordis plugin files here, then call
mount_plugin to activate one in the live Context and see its real
lifecycle (Fiber state, services, effects, events) on the canvas.

`hello-plugin.mjs` is a starter file - a real, minimal, mountable
plugin with no config yet, ready to read and extend.

## Running this folder on its own

This directory is a real, portable Node project - not just files the
tutorial mounts internally. Copy it anywhere and run it standalone:

```sh
pnpm install   # or: npm install
pnpm dev       # or: npm run dev
```

`run.mjs` boots a real @deepseek-ai/cordis Context, hosted with
@deepseek-ai/dsh-host-webserver (the real DeepSeek Harness way to
host a web-facing Context - not an ad hoc keep-alive hack), on
http://127.0.0.1:8790 (try /healthz). It mounts every `*.mjs` plugin
file in this directory into that Context, the same way this
tutorial's own server does via mount_plugin - just without the
tutorial's UI around it.

A plugin file itself does not import @deepseek-ai/cordis - only the
host (run.mjs, or this tutorial's server) does that and passes `ctx`
in. That is the normal Cordis plugin shape, the same as every chapter
example.
