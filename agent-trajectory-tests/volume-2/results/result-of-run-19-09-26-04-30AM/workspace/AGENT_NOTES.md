# Agent Notes

1. **Plugin (.mjs) files (excluding run.mjs): 11**
   - agent-loop.mjs
   - compaction.mjs
   - context-window.mjs
   - env-probe.mjs
   - greeter-consumer.mjs
   - greeter-reporter.mjs
   - greeter.mjs
   - hello-plugin.mjs
   - llm.mjs
   - system-prompt.mjs
   - tools.mjs

2. **`name` field in package.json:** `cordis-plugin-workspace`

3. **What this workspace appears to be:** A sandbox Node project
   containing real, mountable Cordis plugin files that `run.mjs` loads
   into a live DeepSeek Harness Context hosted on a local webserver,
   used as the hands-on plugin workspace for an interactive tutorial.
