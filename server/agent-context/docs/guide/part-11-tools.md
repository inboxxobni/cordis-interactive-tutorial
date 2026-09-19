<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 2087-2457 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: applies. -->

# Part XI — Tools: from Cordis plugin to model-callable capability

## 65. A Tool is not a Cordis primitive

This distinction is fundamental.

Cordis provides:

```text
plugin
service
inject
effect
event
scope
fiber
loader
```

Harness provides a **`tools` Service**.

A model-facing tool is registered into that service:

```ts
ctx.tools.register(...)
```

So a tool plugin is ordinary Cordis composition plus a Harness-specific registry operation.

---

## 66. Minimal tool

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name.',

    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'The name to greet',
      },
    },

    output: {
      schema: { type: 'string' },
      render: (_args, value) => [
        { type: 'text', text: value },
      ],
    },

    async execute(args) {
      return `Hello, ${args.name}!`
    },
  }))
}
```

What happens:

```text
inject tools
   ↓
plugin waits until ToolRuntime exists
   ↓
register tool definition
   ↓
registration becomes owned by plugin Fiber
   ↓
Tool schema joins model-visible tool set
   ↓
plugin unload
   ↓
tool unregisters automatically
```

---

## 67. Tool definition anatomy

```text
name
  stable model-visible operation name

description
  tells model what the operation does

parameters
  validates and types model-supplied arguments

output.schema
  canonical programmatic value contract

execute(args, exec)
  does the real work

output.render(args, value)
  converts canonical value to model-facing Native content

presentation metadata / presenters (optional)
  UI replay/card concern, separate from canonical return
```

---

## 68. The canonical-value rule

A production tool should return a structured canonical value, not prose that other code must parse.

Bad:

```ts
return `Created file at ${path} with id ${id}`
```

if downstream code needs both fields.

Better:

```ts
output: {
  schema: {
    type: 'object',
    properties: {
      path: { type: 'string' },
      id: { type: 'string' },
    },
    required: ['path', 'id'],
  },
  render: (_args, value) => [{
    type: 'text',
    text: `Created ${value.path}`,
  }],
},

async execute(args) {
  return { path, id }
}
```

Programmatic truth belongs in the canonical value. Human/model formatting belongs in the renderer.

---

## 69. Tool argument validation

`defineTool` validates the model-generated arguments according to its parameter DSL before `execute()`.

Inside `execute`, TypeScript can infer argument types.

You still must validate semantic constraints not represented by the schema.

Example:

```ts
parameters: {
  limit: { type: 'number', required: true },
}

async execute(args) {
  if (!Number.isInteger(args.limit) || args.limit <= 0) {
    throw new Error('limit must be a positive integer')
  }
}
```

Do not assume a primitive type check expresses every business invariant.

---

## 70. Honor cancellation

Production tool:

```ts
async execute(args, exec) {
  return await readFile(args.path, {
    encoding: 'utf8',
    signal: exec.signal,
  })
}
```

If a downstream API supports `AbortSignal`, pass `exec.signal`.

If it does not, write an adapter that cooperates with cancellation as far as possible.

Ignoring cancellation creates teardown and session-stopping problems.

---

## 71. Tool identity is runtime-owned

The tool execution runtime protects identity fields such as:

```text
callId
name
arguments
agent
token
signal
optional parent execution identity
```

Treat arguments as read-only input.

Do not mutate the registered tool definition after registration. To replace behavior, let the owning effect/plugin dispose and register a replacement.

That is the Cordis way:

```text
replace component
not mutate hidden shared definition in place
```

---

## 72. Tool error behavior

Infrastructure failure should throw.

A domain-successful but nonideal outcome should often remain a valid canonical value.

Example Bash:

```text
process exited code 2
```

can still be a successfully executed tool whose canonical result contains `exitCode: 2`, rather than an infrastructure exception.

Use exceptions for failure of the tool execution contract itself.

---

## 73. Tool execution policy extension points

Harness exposes a pipeline around tool execution.

Conceptually:

```text
tool call
   ↓
tools/pre-execute
   ↓
tools/execute       ← around-dispatch wrappers
   ↓
actual tool body
   ↓
tools/post-execute
   ↓
normalized result
   ↓
tools/result        ← observation
```

Typical uses:

### `tools/pre-execute`

- permission decision;
- allow/deny/ask policy;
- argument policy.

### `ctx.tools.guard()`

A final monotonic deny mechanism where appropriate. A later extension should not be able to undo the denial.

### `tools/execute`

Around behavior:

- timeout;
- tracing;
- metrics;
- retry when semantically safe;
- execution wrapping.

Remember waterfall semantics: delegate with `next()` unless intentionally replacing/vetoing.

### `tools/post-execute`

- presentation adjustment;
- attach model context;
- confidentiality filtering;
- result transformation under the subsystem contract.

### `tools/result`

Observe normalized immutable outcome.

Good for:

- telemetry;
- logs;
- counters;
- analytics;
- non-mutating observers.

---

## 74. Tool observer example

```ts
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'

export const name = 'tool-logger'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.on('tools/result', (exec, result) => {
    const text = result.content
      .map(block => block.type === 'text' ? block.text : '')
      .join('')

    console.log(`[tool] ${exec.name} -> ${text.slice(0, 120)}`)
  })
}
```

Because `ctx.on()` is an effect, HMR does not accumulate duplicate observers.

---

## 75. Code Mode

Harness can expose registered visible tools programmatically through Code Mode, conceptually:

```ts
await tools.some_tool(args)
```

The key architecture property is that the call re-enters the normal tool pipeline rather than bypassing policy/lifecycle.

Code Mode receives the canonical value, not the rendered prose content.

Therefore canonical output schemas are APIs, not only display metadata.

---

## 76. Background work

Long-running work should not be implemented by returning from a tool while a detached promise keeps mutating state.

Harness provides a jobs capability for published background work.

Follow the jobs subsystem pattern so:

- work has an owner;
- it has an ID;
- cancellation semantics are explicit;
- owner disposal can clean it;
- output/read lifecycle is bounded;
- the tool returns a canonical handle.

The outer tool's `exec.signal` is appropriate for foreground work. Once background work is formally published, its task-owned cancellation lifecycle takes over according to the jobs contract.

---
