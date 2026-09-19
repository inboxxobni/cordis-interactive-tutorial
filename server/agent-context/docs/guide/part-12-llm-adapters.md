<!-- Synced from acryl docs/cordis/cordis_system_guide_for_coding_agents.md lines 2458-2667 by server/scripts/sync-agent-docs.mjs. Do not edit here; edit the source and re-sync. Sandbox applicability: partial. -->

# Part XII — LLM adapters

## 77. LLM adapter role

The LLM subsystem is another capability seam.

A provider adapter translates:

```text
Harness GenerateOptions
        ↓
provider-specific API request
        ↓
provider stream
        ↓
Harness StreamChunk protocol
```

The agent loop should not know provider SDK details.

---

## 78. Minimal adapter skeleton

```ts
import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import {
  LlmAdapter,
  type GenerateOptions,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'

class MyAdapter extends LlmAdapter {
  constructor(private apiKey: string) {
    super()
  }

  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    // 1. translate options -> provider request
    // 2. stream provider response
    // 3. yield valid Harness chunks
  }
}

export interface Config {
  apiKey: string
  providers: string[]
}

export const Config: Schema<Config> = Schema.object({
  apiKey: Schema.string().required(),
  providers: Schema.array(Schema.string()).required(),
})

export const name = 'my-llm-adapter'
export const inject = ['llm']

export function apply(ctx: Context, config: Config) {
  const adapter = new MyAdapter(config.apiKey)
  ctx.llm.registerAdapter(config.providers, adapter)
}
```

The registration belongs to the adapter plugin's Fiber.

---

## 79. StreamChunk protocol

Canonical text stream:

```ts
async function* stream(): AsyncIterable<StreamChunk> {
  yield {
    type: 'block-start',
    index: 0,
    blockType: 'text',
  }

  yield {
    type: 'text-delta',
    index: 0,
    text: 'Hello',
  }

  yield {
    type: 'text-delta',
    index: 0,
    text: ' world',
  }

  yield {
    type: 'block-end',
    index: 0,
    block: {
      type: 'text',
      text: 'Hello world',
    },
  }

  yield {
    type: 'usage',
    usage: {
      inputTokens: 100,
      outputTokens: 2,
    },
  }

  yield {
    type: 'finish',
    reason: { kind: 'stop' },
  }
}
```

Tool-call block pattern:

```ts
yield {
  type: 'block-start',
  index: 1,
  blockType: 'tool-call',
}

yield {
  type: 'tool-call-delta',
  index: 1,
  id: CallId('call-123'),
  name: 'greet',
  argumentsDelta: '{"name":"Ada"}',
}

yield {
  type: 'block-end',
  index: 1,
  block: {
    type: 'tool-call',
    id: CallId('call-123'),
    name: 'greet',
    arguments: '{"name":"Ada"}',
  },
}

yield {
  type: 'finish',
  reason: { kind: 'tool-calls' },
}
```

Rules:

```text
[ ] block-start has matching block-end
[ ] index identifies content-block order
[ ] tool-call argumentsDelta is raw JSON text
[ ] usage precedes finish
[ ] finish is the final chunk
```

---

## 80. Adapter errors and cancellation

Provider failures should become stable Harness LLM errors, not arbitrary silent fallbacks.

Pattern:

```ts
import {
  attributionHeaders,
  LlmAdapter,
  LlmError,
} from '@deepseek-ai/dsh-llm'

class HttpAdapter extends LlmAdapter {
  async *stream(options: GenerateOptions) {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...attributionHeaders(),
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
      }),
      signal: options.signal,
    })

    if (!response.ok) {
      throw new LlmError(
        `Provider API error: ${response.status}`,
        'PROVIDER_HTTP_ERROR',
      )
    }

    // parse stream...
  }
}
```

### Rule

If Harness supplies cancellation, forward it to the provider SDK/request.

Do not silently drop unsupported explicit generation fields. Follow the adapter contract and fail with a meaningful stable error when the provider cannot honor a required option.

---
