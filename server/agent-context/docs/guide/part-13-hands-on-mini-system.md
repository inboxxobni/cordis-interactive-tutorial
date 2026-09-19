<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 2668-3206 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XIII — An end-to-end hands-on Cordis mini-system

## 81. Goal

Build a small replaceable capability from scratch:

```text
TextTransform service definition
       │
       ├── Uppercase provider
       └── Lowercase provider

Transform tool consumer

Metrics observer

cordis.yml chooses provider

HMR/provider swap demonstrates reactivity
```

This example intentionally mirrors a real agent capability seam while remaining keyless and deterministic.

---

## 82. Setup against DeepSeek Harness checkout

From repository root:

```sh
pnpm install
mkdir -p tmp/cordis-system-guide
cd tmp/cordis-system-guide
```

Run tutorial compositions with:

```sh
node --import tsx ../../vendor/cordis/bin.js
```

The launcher creates the root Context, mounts Loader, and reads `./cordis.yml`.

---

## 83. Step 1 — first plugin

Create `hello.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'hello'

export function apply(ctx: Context) {
  console.log('[hello] active')
}
```

`cordis.yml`:

```yaml
- id: hello
  name: './hello.ts'
```

Run:

```sh
node --import tsx ../../vendor/cordis/bin.js
```

Expected:

```text
[hello] active
```

---

## 84. Step 2 — add an owned effect

Create `heartbeat.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'

export const name = 'heartbeat'

export function apply(ctx: Context) {
  ctx.effect(() => {
    const timer = setInterval(() => {
      console.log('[heartbeat] tick')
    }, 1000)

    return () => {
      clearInterval(timer)
      console.log('[heartbeat] disposed')
    }
  })
}
```

Add it:

```yaml
- id: heartbeat
  name: './heartbeat.ts'
```

Now HMR/disabling this plugin can stop the timer cleanly.

---

## 85. Step 3 — define the service contract

Create `transform-service.ts`:

```ts
import { Service, type Context } from '@deepseek-ai/cordis'

export interface TransformRequest {
  text: string
}

export interface TransformResult {
  text: string
  provider: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    textTransform: TextTransformService
  }
}

export abstract class TextTransformService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'textTransform')
  }

  abstract transform(
    request: TransformRequest,
  ): Promise<TransformResult>
}
```

This file defines the **stable capability API**.

It does not choose an implementation.

---

## 86. Step 4 — provider A

Create `transform-uppercase.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'
import {
  TextTransformService,
  type TransformRequest,
  type TransformResult,
} from './transform-service.ts'

class UppercaseTransform extends TextTransformService {
  async transform(
    request: TransformRequest,
  ): Promise<TransformResult> {
    return {
      text: request.text.toUpperCase(),
      provider: 'uppercase',
    }
  }
}

export const name = 'transform-uppercase'

export function apply(ctx: Context) {
  ctx.plugin(UppercaseTransform)
}
```

Add:

```yaml
- id: transform-provider
  name: './transform-uppercase.ts'
```

---

## 87. Step 5 — direct service consumer

Create `transform-consumer.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from './transform-service.ts'

export const name = 'transform-consumer'
export const inject = ['textTransform']

export function apply(ctx: Context) {
  void ctx.textTransform
    .transform({ text: 'Cordis' })
    .then(result => {
      console.log('[consumer]', result)
    })
}
```

Add:

```yaml
- id: transform-consumer
  name: './transform-consumer.ts'
```

Load order does not matter. `inject` is the dependency.

---

## 88. Step 6 — declare an event

Add to `transform-service.ts`:

```ts
declare module '@deepseek-ai/cordis' {
  interface Context {
    textTransform: TextTransformService
  }

  interface Events {
    'text-transform/result'(result: TransformResult): void
  }
}
```

Update provider:

```ts
class UppercaseTransform extends TextTransformService {
  async transform(request: TransformRequest): Promise<TransformResult> {
    const result = {
      text: request.text.toUpperCase(),
      provider: 'uppercase',
    }

    this.ctx.emit('text-transform/result', result)
    return result
  }
}
```

Because `ctx` in `Service` is protected, the subclass can use it.

---

## 89. Step 7 — event observer

Create `transform-metrics.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from './transform-service.ts'

export const name = 'transform-metrics'

export function apply(ctx: Context) {
  let count = 0

  ctx.on('text-transform/result', result => {
    count += 1
    console.log(
      `[metrics] count=${count} provider=${result.provider}`,
    )
  })
}
```

Add:

```yaml
- id: transform-metrics
  name: './transform-metrics.ts'
```

The observer does not need to know provider or consumer packages.

---

## 90. Step 8 — make provider configurable

Update `transform-uppercase.ts`:

```ts
import Schema from '@deepseek-ai/schemastery'

export interface Config {
  prefix: string
}

export const Config: Schema<Config> = Schema.object({
  prefix: Schema.string().default(''),
})

class UppercaseTransform extends TextTransformService {
  constructor(
    ctx: Context,
    private prefix: string,
  ) {
    super(ctx)
  }

  async transform(request: TransformRequest): Promise<TransformResult> {
    const result = {
      text: this.prefix + request.text.toUpperCase(),
      provider: 'uppercase',
    }

    this.ctx.emit('text-transform/result', result)
    return result
  }
}

export function apply(ctx: Context, config: Config) {
  ctx.plugin(class Provider extends UppercaseTransform {
    constructor(childCtx: Context) {
      super(childCtx, config.prefix)
    }
  })
}
```

For production code, prefer a simpler named provider class/factory structure rather than an anonymous class if diagnostics/type ergonomics suffer. The point is that deployment-specific values come from validated config.

YAML:

```yaml
- id: transform-provider
  name: './transform-uppercase.ts'
  config:
    prefix: '[UP] '
```

---

## 91. Step 9 — add the Harness Tool consumer

Create `transform-tool.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from './transform-service.ts'

export const name = 'transform-tool'
export const inject = ['tools', 'textTransform']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'transform_text',
    description: 'Transform text using the configured text-transform provider.',

    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'Text to transform',
      },
    },

    output: {
      schema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          provider: { type: 'string' },
        },
        required: ['text', 'provider'],
      },

      render: (_args, value) => [{
        type: 'text',
        text: `${value.text}\n(provider: ${value.provider})`,
      }],
    },

    async execute(args, exec) {
      if (exec.signal.aborted) {
        throw exec.signal.reason ?? new Error('aborted')
      }

      return ctx.textTransform.transform({
        text: args.text,
      })
    },
  }))
}
```

This plugin requires two independent services:

```text
tools
textTransform
```

It activates only while both are present.

---

## 92. Step 10 — compose with real Harness tool runtime

Minimal keyless tool-pipeline composition from the official tutorial requires system prompt + tools:

```yaml
- id: system-prompt
  name: '@deepseek-ai/dsh-system-prompt'

- id: tools
  name: '@deepseek-ai/dsh-tools'

- id: transform-provider
  name: './transform-uppercase.ts'
  config:
    prefix: '[UP] '

- id: transform-metrics
  name: './transform-metrics.ts'

- id: transform-tool
  name: './transform-tool.ts'
```

Why `system-prompt`?

The tools service contributes schemas to system-prompt assembly and therefore has its own injection requirements.

When a subsystem stays `PENDING`, inspect **its dependencies too**, not only your plugin's.

---

## 93. Step 11 — provider B

Create `transform-lowercase.ts`:

```ts
import type { Context } from '@deepseek-ai/cordis'
import {
  TextTransformService,
  type TransformRequest,
  type TransformResult,
} from './transform-service.ts'

class LowercaseTransform extends TextTransformService {
  async transform(
    request: TransformRequest,
  ): Promise<TransformResult> {
    const result = {
      text: request.text.toLowerCase(),
      provider: 'lowercase',
    }

    this.ctx.emit('text-transform/result', result)
    return result
  }
}

export const name = 'transform-lowercase'

export function apply(ctx: Context) {
  ctx.plugin(LowercaseTransform)
}
```

Now change only the provider row:

```yaml
- id: transform-provider
  name: './transform-lowercase.ts'
```

The service name stays:

```text
textTransform
```

but provider identity changes.

Consumers injecting it are reconciled to the new capability environment.

That is spatial composability in practical form.

---

## 94. Step 12 — deliberately remove the provider

Disable it:

```yaml
- id: transform-provider
  name: './transform-lowercase.ts'
  disabled: true
```

Expected conceptual state:

```text
transform-provider → not active
transform-consumer → PENDING
transform-tool     → PENDING because textTransform missing
metrics observer  → can remain ACTIVE because it does not require textTransform
```

Re-enable provider and consumers can reactivate.

---

## 95. Step 13 — verify no duplicate registrations

With HMR running, edit provider/tool several times.

Verify:

```text
[ ] transform_text appears once
[ ] metrics listener runs once per result
[ ] no old provider is called
[ ] no old timer/watch survives
[ ] provider swap changes output immediately after reconciliation
```

If duplicate behavior appears, find the unmanaged effect.

---
