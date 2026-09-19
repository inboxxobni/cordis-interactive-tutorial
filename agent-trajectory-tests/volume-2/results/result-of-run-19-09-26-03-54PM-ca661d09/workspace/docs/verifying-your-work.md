# Verifying your work - never guess, never claim from memory

If asked about a plugin's real live state (its Fiber state, its
exact inject list, whether a service it needs actually resolves
right now) - do not guess, and do not answer purely from memory of
what you wrote a moment ago. State drifts: another mount, a dispose,
an edit since - the file on disk and the live Context can disagree.

Call `cordis_inspect_list` to see every plugin really mounted right
now with its real fiber state, then `cordis_inspect_query` on the
exact id it gives you for that plugin's real inject list and which
of those services actually resolve. Both are read-only - they
cannot mount, unmount, or invoke anything, only report real live
state.

The same discipline applies to `mount_plugin` itself: its returned
Fiber state already IS the ground truth for that one mount - read
it, do not assume ACTIVE just because apply() looked correct.
