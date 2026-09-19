<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 3916-4029 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XX — Testing Cordis components

## 125. Minimum lifecycle test matrix

Every serious plugin should be tested under more than startup.

```text
[ ] initial mount
[ ] invalid config
[ ] required provider missing
[ ] provider appears later
[ ] provider disappears
[ ] provider replaced by compatible implementation
[ ] plugin config update
[ ] source HMR/restart
[ ] explicit fiber.dispose()
[ ] parent disposal
[ ] async work aborted during unload
[ ] repeated mount/unmount cycles
[ ] no duplicate registrations after N cycles
```

---

## 126. Effect leak test

Record baseline counts:

```text
listeners
registered tools
open watchers
active timers
provider entries
child Fibers
```

Then:

```text
mount → activate → dispose
```

Repeat many times.

Final state should equal baseline for everything the plugin owned.

This is the engineering approximation of recovery/observational equivalence.

---

## 127. Provider replacement test

Given:

```text
consumer injects myCap
```

Test:

```text
provider A mount
consumer ACTIVE
call → A

replace A with B
consumer unload/reload
call → B

assert A no longer receives calls
assert consumer registration count stays 1
```

---

## 128. Waterfall contract test

Test both delegation and veto.

```ts
ctx.on('my/request', async (req, next) => {
  trace.push('outer-before')
  const result = await next()
  trace.push('outer-after')
  return result
})
```

Assert order around downstream execution.

Then add a veto listener and assert the default handler did not run.

---

## 129. Tool contract tests

At minimum:

```text
[ ] valid args execute
[ ] invalid args rejected before body
[ ] semantic validation errors clear
[ ] canonical output matches output.schema
[ ] renderer produces expected model content
[ ] cancellation reaches operation
[ ] tool unregisters on plugin unload
[ ] policy hooks still run
[ ] Code Mode receives canonical value
[ ] replay/UI presenter is pure if provided
```

---
