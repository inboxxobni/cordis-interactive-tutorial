<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 1185-1429 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part VI — Services and live dependency injection

## 35. What a Service is

A Service is a named capability.

Examples in Harness:

```ts
ctx.tools
ctx.llm
ctx.agents
ctx.sessions
ctx.systemPrompt
ctx.shell
ctx.fs
ctx.sandbox
ctx.jobs
```

A consumer should depend on the **capability name/interface**, not on the concrete provider package.

---

## 36. Provide a custom service

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

declare module '@deepseek-ai/cordis' {
  interface Context {
    greeter: GreeterService
  }
}

export class GreeterService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'greeter')
  }

  greet(name: string) {
    return `Hello, ${name}!`
  }
}

export const name = 'greeter-provider'

export function apply(ctx: Context) {
  ctx.plugin(GreeterService)
}
```

Two independent things happen:

### Runtime

```ts
super(ctx, 'greeter')
```

provides the service in the current Cordis scope.

### Compile time

```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    greeter: GreeterService
  }
}
```

teaches TypeScript that `ctx.greeter` exists.

Declaration merging alone does **not** provide anything at runtime.

---

## 37. Consume a required service with `inject`

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from './greeter-provider.ts'

export const name = 'greeter-consumer'
export const inject = ['greeter']

export function apply(ctx: Context) {
  console.log(ctx.greeter.greet('Ada'))
}
```

The contract is:

```text
apply() runs only while greeter is available in this service scope
```

Do not duplicate runtime checks inside `apply()` for a hard dependency.

---

## 38. Required vs optional dependencies

### Required

```ts
export const inject = ['metrics']

export function apply(ctx: Context) {
  ctx.metrics.record('loaded', 1)
}
```

Plugin should not run without the capability.

### Optional

```ts
export function apply(ctx: Context) {
  const metrics = ctx.get('metrics')
  metrics?.record('loaded', 1)
}
```

Plugin remains useful without the capability.

### Decision rule

Ask:

> If this service does not exist, is the plugin's behavior still valid and complete?

- no → `inject`;
- yes → optional lookup or a separate dependency-gated sub-plugin.

---

## 39. Never use YAML order as dependency order

Wrong assumption:

```yaml
- name: './provider.ts'
- name: './consumer.ts'
```

Therefore provider loads first.

That is **not** the Cordis contract. Entries may start concurrently.

Correct dependency:

```ts
export const inject = ['myService']
```

`cordis.yml` says **what exists**. `inject` says **what must be ready before activation**.

---

## 40. Dynamic provider replacement

Suppose provider A and B implement the same service definition.

Consumer:

```ts
export const inject = ['translator']

export function apply(ctx: Context) {
  ctx.on('document/received', doc => {
    void ctx.translator.translate(doc.text)
  })
}
```

Swap provider A for B in configuration.

Correct Cordis behavior:

```text
1. old provider leaves
2. consumer's active episode unloads
3. consumer-owned listener disappears
4. new provider activates
5. consumer reactivates
6. listener is registered again against the new dependency environment
```

No stale provider reference survives if the plugin follows ownership rules.

---

## 41. Service definition / provider / consumer = capability seam

For a capability intended to have replaceable implementations, use three roles.

```text
             Service Definition
           interface + request/result
              /             \
             /               \
        Provider           Consumer
      implementation     tool/feature/etc.
```

DeepSeek Harness's Bash family is the canonical pattern:

```text
dsh-shell         → definition

dsh-bash-local    → provider

dsh-tool-bash     → consumer/model-facing tool
```

Provider and consumer depend on the definition. They should not depend on each other.

---

## 42. Do not split every tiny feature into three packages

Capability seams are valuable when implementations need to vary independently.

For a one-off tool whose implementation is unlikely to be replaced, this is enough:

```text
one plugin
  └── registers one tool
```

Split when you need:

- multiple providers;
- environment-specific execution;
- independent security/policy boundary;
- independent API evolution;
- multiple different consumers;
- per-agent or per-group provider selection.

Architecture is not improved by package count alone.

---
