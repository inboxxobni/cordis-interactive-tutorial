<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1647-1791 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part VIII — Plugin configuration

## 49. Config type + runtime schema

Recommended pattern:

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  greeting: string
  maxRetries: number
  verbose: boolean
}

export const Config: Schema<Config> = Schema.object({
  greeting: Schema.string().default('Hello'),
  maxRetries: Schema.number().default(3),
  verbose: Schema.boolean().default(false),
})

export function apply(ctx: Context, config: Config) {
  console.log(config.greeting)
}
```

A TypeScript interface is compile-time only.

The exported runtime `Config` schema validates input before activation.

---

## 50. Fail before partial activation

Bad configuration should prevent `apply()` from running.

This is desirable:

```text
raw config
   ↓
validate + defaults
   ↓ invalid
FAILED
```

rather than:

```text
apply half starts
opens resources
then discovers bad config
then tries to recover manually
```

Use schema constraints for self-contained validation.

Use dependency-aware validation for resource/provider names that can only be resolved once services are active.

---

## 51. Tunable deployment values belong in config

Bad:

```ts
const TIMEOUT_MS = 30_000
```

if deployments may legitimately differ.

Better:

```ts
export interface Config {
  timeoutMs: number
}

export const Config = Schema.object({
  timeoutMs: Schema.number().default(30_000),
})
```

Rule:

> If two deployments may need different values, `cordis.yml` should be able to change it without editing source.

---

## 52. `!!js` computed configuration in Harness Loader

Harness's Loader/Include layer supports computed values in `config`:

```yaml
- id: demo
  name: './demo.ts'
  config:
    apiKey: !!js process.env.DEMO_API_KEY
```

And computed `disabled`:

```yaml
- id: platform-feature
  name: './platform-feature.ts'
  disabled: !!js process.platform !== 'darwin'
```

Important behavior in the current Harness patches:

- plugin `config` expressions are resolved lazily when declared injections are active, against that plugin context;
- `disabled` is evaluated at mount decisions against Loader context;
- other entry metadata stays literal;
- nested Include rows preserve expressions until the owning row activates.

Do not assume arbitrary YAML fields execute JavaScript.

---

## 53. Config update and HMR

A config edit can cause the plugin's old activation episode to unload and the new one to activate.

That is why lifecycle-clean registrations matter even when source code never changes.

The test is:

```text
change config 20 times
```

and confirm there is still:

```text
one listener
one tool registration
one timer
one provider
```

not 20 of each.

---
