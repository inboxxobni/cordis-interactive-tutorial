export const name = 'llm'

const DEFAULT_BASE_BY_PROVIDER = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
}

const DEFAULT_MODEL_BY_PROVIDER = {
  deepseek: 'deepseek-chat',
  openai: 'gpt-4o-mini',
}

const PROVIDER_TIMEOUT_MS = 120_000

/**
 * Credentials and endpoint come from the environment only
 * (CORDIS_AGENT_PROVIDER / _MODEL / _API_KEY / _BASE_URL) - never from a file,
 * and never from the user.
 */
function readEnv() {
  const provider = (process.env.CORDIS_AGENT_PROVIDER || 'deepseek').toLowerCase()
  const apiKey = process.env.CORDIS_AGENT_API_KEY || ''
  const explicitBase = process.env.CORDIS_AGENT_BASE_URL || ''
  const baseUrl = (explicitBase || DEFAULT_BASE_BY_PROVIDER[provider] || DEFAULT_BASE_BY_PROVIDER.deepseek)
    .replace(/\/+$/, '')
  const model = process.env.CORDIS_AGENT_MODEL || DEFAULT_MODEL_BY_PROVIDER[provider] || 'deepseek-chat'
  return { provider, apiKey, baseUrl, model, explicitBase }
}

function endpointFor({ baseUrl, provider }) {
  if (/\/chat\/completions$/.test(baseUrl)) return baseUrl
  if (/\/v1$/.test(baseUrl)) return `${baseUrl}/chat/completions`
  // Anthropic's native API is different; only use it if pointed there explicitly.
  if (provider === 'anthropic' && !baseUrl.includes('/v1')) return `${baseUrl}/v1/messages`
  return `${baseUrl}/v1/chat/completions`
}

function shapeMessage(message = {}) {
  const out = { role: message.role ?? 'user' }
  if (message.content != null) out.content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
  if (message.name) out.name = message.name
  if (message.tool_call_id) out.tool_call_id = message.tool_call_id
  const calls = message.toolCalls ?? message.tool_calls
  if (Array.isArray(calls) && calls.length) {
    out.tool_calls = calls.map((call, index) => ({
      id: call.id ?? `call_${index}`,
      type: 'function',
      function: {
        name: call.name ?? call.function?.name,
        arguments: typeof call.input === 'string'
          ? call.input
          : JSON.stringify(call.input ?? call.function?.arguments ?? {}),
      },
    }))
  }
  return out
}

/** Accepts `definitions` in either {name, description, input_schema} or JSON-schema-ish shape. */
function shapeTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined
  return tools.map((tool) => {
    if (tool?.type === 'function' && tool.function) return tool
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description ?? '',
        parameters: tool.input_schema ?? tool.parameters ?? { type: 'object', properties: {} },
      },
    }
  })
}

function parseToolCalls(choice = {}) {
  const raw = choice.message?.tool_calls ?? choice.tool_calls ?? []
  return (Array.isArray(raw) ? raw : []).map((call, index) => {
    const fn = call.function ?? call
    let input = fn.arguments ?? call.input ?? {}
    if (typeof input === 'string') {
      try { input = JSON.parse(input) } catch { input = { raw: input } }
    }
    return { id: call.id ?? `call_${index}`, name: fn.name ?? call.name, input }
  }).filter((call) => typeof call.name === 'string' && call.name)
}

async function request(body, { apiKey, endpoint, provider }) {
  if (!apiKey) {
    throw new Error('CORDIS_AGENT_API_KEY is not set in the environment; cannot call the LLM')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  let response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        ...(provider === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`LLM request timed out after ${PROVIDER_TIMEOUT_MS}ms`)
    throw new Error(`LLM request failed: ${err?.message ?? err}`)
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`LLM HTTP ${response.status} ${response.statusText}: ${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`LLM returned non-JSON body: ${text.slice(0, 300)}`)
  }
}

const llm = {
  name: 'llm',

  /** Live config view - read from env each call so changes are picked up. */
  get config() {
    const env = readEnv()
    return {
      provider: env.provider,
      model: env.model,
      baseUrl: env.baseUrl,
      endpoint: endpointFor(env),
      hasApiKey: Boolean(env.apiKey),
    }
  },

  /**
   * One real completion. `messages` is the conversation; `tools` is
   * ctx.tools.definitions (or compatible). Returns
   * { content, toolCalls, message, usage, model }.
   */
  async chat(messages, tools, options = {}) {
    const env = readEnv()
    const endpoint = endpointFor(env)
    const payloadMessages = (Array.isArray(messages) ? messages : []).map(shapeMessage)
    const schemaTools = shapeTools(tools)

    if (env.provider === 'anthropic' && endpoint.endsWith('/messages')) {
      return await this.chatAnthropic({ env, endpoint, payloadMessages, tools: schemaTools, options })
    }

    const body = {
      model: options.model ?? env.model,
      messages: payloadMessages,
      ...(schemaTools ? { tools: schemaTools } : {}),
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      stream: false,
    }

    const data = await request(body, { apiKey: env.apiKey, endpoint, provider: env.provider })
    const choice = data?.choices?.[0] ?? {}
    const toolCalls = parseToolCalls(choice)
    const content = choice.message?.content ?? choice.text ?? ''

    const message = { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) }
    if (toolCalls.length) {
      message.tool_calls = toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: JSON.stringify(c.input ?? {}) },
      }))
    }

    return {
      content: message.content,
      toolCalls,
      message,
      usage: data?.usage,
      model: data?.model ?? body.model,
      finishReason: choice.finish_reason,
      endpoint,
    }
  },

  /** Anthropic-native path, used only when the base URL points at /v1/messages. */
  async chatAnthropic({ env, endpoint, payloadMessages, tools, options }) {
    const system = payloadMessages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n')
    const rest = payloadMessages.filter((m) => m.role !== 'system')
    const body = {
      model: options.model ?? env.model,
      max_tokens: options.maxTokens ?? 4096,
      ...(system ? { system } : {}),
      messages: rest.map((m) => {
        if (m.role === 'tool') {
          return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }] }
        }
        if (m.tool_calls) {
          return {
            role: 'assistant',
            content: [
              ...(m.content ? [{ type: 'text', text: m.content }] : []),
              ...m.tool_calls.map((c) => ({
                type: 'tool_use',
                id: c.id,
                name: c.function.name,
                input: JSON.parse(c.function.arguments || '{}'),
              })),
            ],
          }
        }
        return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }
      }),
      ...(tools ? { tools: tools.map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })) } : {}),
    }

    const data = await request(body, { apiKey: env.apiKey, endpoint, provider: env.provider })
    const blocks = Array.isArray(data?.content) ? data.content : []
    const content = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('')
    const toolCalls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input ?? {} }))
    const message = { role: 'assistant', content }
    if (toolCalls.length) {
      message.tool_calls = toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } }))
    }
    return { content, toolCalls, message, usage: data?.usage, model: data?.model ?? body.model, finishReason: data?.stop_reason, endpoint }
  },

  /** Smallest possible real call, for a connectivity check. */
  async ping() {
    const reply = await this.chat([{ role: 'user', content: 'Reply with the single word: ok' }])
    return { ok: true, model: reply.model, content: reply.content }
  },
}

export function apply(ctx) {
  const env = readEnv()
  ctx.provide('llm', llm)
  ctx.logger?.info?.(
    '[llm] providing llm (provider %s, model %s, key %s)',
    env.provider,
    env.model,
    env.apiKey ? 'set' : 'MISSING',
  )
  if (!env.apiKey) ctx.logger?.warn?.('[llm] CORDIS_AGENT_API_KEY is not set - chat() will throw until it is')
  ctx.logger?.info?.('[llm] endpoint %s', endpointFor(env))
  ctx.effect(() => () => ctx.logger?.info?.('[llm] disposed'))
}

export default { name, apply }
