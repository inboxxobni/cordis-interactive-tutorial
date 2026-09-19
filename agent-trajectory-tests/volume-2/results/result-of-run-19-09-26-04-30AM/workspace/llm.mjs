export const name = 'llm'

// Credentials come from the environment only - never asked for, never written
// to disk, never logged. Presence of all four is required at load time.
const provider = (process.env.CORDIS_AGENT_PROVIDER ?? '').trim().toLowerCase()
const model = process.env.CORDIS_AGENT_MODEL
const apiKey = process.env.CORDIS_AGENT_API_KEY
const baseUrl = (process.env.CORDIS_AGENT_BASE_URL ?? '').replace(/\/+$/, '')

if (!provider || !model || !apiKey || !baseUrl) {
  throw new Error(
    'llm: CORDIS_AGENT_PROVIDER / CORDIS_AGENT_MODEL / CORDIS_AGENT_API_KEY / CORDIS_AGENT_BASE_URL must all be set',
  )
}

// Anthropic's Messages API is a genuinely different wire format (top-level
// system, content blocks, x-api-key). Everything else in this harness speaks
// the OpenAI-compatible chat-completions shape.
const isAnthropic = provider === 'anthropic'

/* ---------------------------------------------------------------- OpenAI-ish */

function toOpenAITools(tools) {
  return (tools ?? []).map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema ?? { type: 'object', properties: {} },
    },
  }))
}

function messageToProvider(message) {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content }
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: message.toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
      })),
    }
  }
  return { role: message.role, content: message.content }
}

function replyFromProvider(message) {
  const toolCalls = (message.tool_calls ?? []).map((c) => {
    let input = {}
    try {
      input = JSON.parse(c.function?.arguments ?? '{}')
    } catch {
      input = {}
    }
    return { id: c.id, name: c.function?.name, input }
  })

  return { role: 'assistant', content: message.content ?? '', toolCalls }
}

/* ------------------------------------------------------------------ Anthropic */

function toAnthropicTools(tools) {
  return (tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema ?? { type: 'object', properties: {} },
  }))
}

function toAnthropicMessages(messages, system) {
  const out = []
  for (const m of messages) {
    if (m.role === 'system') continue // hoisted to the top-level `system` field
    if (m.role === 'tool') {
      // Tool results arrive as user-role blocks referencing the tool_use id.
      out.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
      })
      continue
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      const content = []
      if (m.content) content.push({ type: 'text', text: m.content })
      for (const c of m.toolCalls) content.push({ type: 'tool_use', id: c.id, name: c.name, input: c.input ?? {} })
      out.push({ role: 'assistant', content })
      continue
    }
    out.push({ role: m.role, content: m.content ?? '' })
  }
  return { system: system || undefined, messages: out }
}

function replyFromAnthropic(payload) {
  const blocks = payload?.content ?? []
  let text = ''
  const toolCalls = []
  for (const b of blocks) {
    if (b.type === 'text') text += b.text ?? ''
    else if (b.type === 'tool_use') toolCalls.push({ id: b.id, name: b.name, input: b.input ?? {} })
  }
  return { role: 'assistant', content: text, toolCalls }
}

/* ---------------------------------------------------------------------- Service */

const service = {
  provider,
  model,
  isAnthropic,

  async chat(messages, tools) {
    if (!Array.isArray(messages)) throw new Error('llm.chat: messages must be an array')

    let endpoint
    let headers
    let body

    if (isAnthropic) {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
      const converted = toAnthropicMessages(messages, system)
      endpoint = `${baseUrl}/v1/messages`
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
      body = { model, max_tokens: 4096, messages: converted.messages }
      if (converted.system) body.system = converted.system
      if (tools?.length) body.tools = toAnthropicTools(tools)
    } else {
      endpoint = `${baseUrl}/chat/completions`
      headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }
      body = { model, messages: messages.map(messageToProvider) }
      if (tools?.length) {
        body.tools = toOpenAITools(tools)
        body.tool_choice = 'auto'
      }
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      // Truncated: provider error bodies can be long, and this string may end
      // up in the transcript.
      throw new Error(`llm HTTP ${res.status}: ${text.slice(0, 500)}`)
    }

    const data = await res.json()

    if (isAnthropic) return replyFromAnthropic(data)
    const message = data.choices?.[0]?.message
    if (!message) throw new Error('llm: response missing choices[0].message')
    return replyFromProvider(message)
  },
}

export function apply(ctx) {
  ctx.provide('llm', service)
}
