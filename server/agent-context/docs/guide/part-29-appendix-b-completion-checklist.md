<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 4563-4636 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Appendix B — Coding-agent completion checklist

Before declaring a Cordis feature complete:

```text
ARCHITECTURE
[ ] Correct owning subsystem chosen
[ ] Plugin boundary justified
[ ] Service/provider/consumer roles separated only where useful

DEPENDENCIES
[ ] Hard dependencies in inject
[ ] Optional dependencies intentionally optional
[ ] No YAML-order dependency
[ ] No concrete provider import where a seam is intended

LIFECYCLE
[ ] Every raw resource has cleanup
[ ] No detached long-running promise
[ ] Cleanup quiesces async work
[ ] Order-dependent teardown is inside one disposer
[ ] Repeated activation does not accumulate state

CONFIG
[ ] Runtime schema exported
[ ] Defaults validated
[ ] Deployment tunables configurable
[ ] Stable row id used
[ ] Patch semantics understood

EVENTS
[ ] Correct dispatch mode chosen
[ ] Waterfall observers call next()
[ ] Listener registration is lifecycle-owned
[ ] Durable fact vs live event distinction is correct

TOOLS
[ ] Parameters typed/validated
[ ] Canonical output schema is useful programmatically
[ ] Renderer contains prose, canonical value contains data
[ ] Cancellation signal honored
[ ] Tool disappears on plugin unload
[ ] Policy pipeline not bypassed

LLM
[ ] Provider-neutral request mapping correct
[ ] StreamChunk ordering valid
[ ] block-start/block-end pairs valid
[ ] usage before finish
[ ] signal forwarded
[ ] stable LlmError used for provider failures

HMR / REPLACEMENT
[ ] Source reload tested
[ ] Config reload tested
[ ] Provider swap tested
[ ] Missing provider → PENDING tested
[ ] Candidate failure/rollback behavior understood
[ ] No duplicate listener/tool/provider after repeated reload

SECURITY / DURABILITY
[ ] Cordis isolation not treated as sandbox
[ ] External irreversible effects explicitly considered
[ ] Model-visible replay-critical state persisted through session model

DIAGNOSTICS
[ ] Useful plugin name
[ ] Errors fail loud enough to diagnose
[ ] Fiber state can be inspected
[ ] Effect leaks can be audited
```

---
