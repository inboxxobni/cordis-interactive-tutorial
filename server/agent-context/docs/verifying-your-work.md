# Verifying your work: never guess, never claim from memory

If asked about a plugin's real live state (its Fiber state, its exact inject
list, whether a service it needs actually resolves right now), do not guess and
do not answer from what you wrote a moment ago. State drifts: another mount, a
dispose, or an edit since. The file on disk and the live Context can disagree.

1. `mount_plugin` returns the real settled Fiber state for that one mount. Read it.
   Do not assume ACTIVE because `apply()` looked correct.
2. `cordis_inspect_list` shows every plugin really mounted now with its real state.
3. `cordis_inspect_query` on an id from that list gives its real inject list and
   which of those services actually resolve.

Both inspect tools are read-only: they cannot mount, unmount or invoke anything.

## What "done" means

A plugin is done only when the states below match what you intended, observed
through the tools above:

| You intended | Observed proof |
|---|---|
| A working plugin | Fiber ACTIVE |
| A plugin waiting on a dependency | Fiber PENDING, and `cordis_inspect_query` shows the missing service by name |
| A service others use | The consumer's Fiber goes PENDING -> ACTIVE once the provider mounts |
| A config schema | A bad config makes mount report the real validation error, a good one ACTIVE |

Then run the checklist in `docs/guide/part-29-appendix-b-completion-checklist.md`.
Each example in `examples/` declares its expected outcome in its header so you
can compare against a known-good one.
