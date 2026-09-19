export const name = 'llm'

// Credentials come ONLY from the environment (set from Settings) - never
// from a config file, never asked for, never logged.
const env = process.env
const PROVIDER = (env.CORDIS_AGENT_PROVIDER || 'openai').toLowerCase()
const MODEL = env.CORDIS_AGENT_MODEL || env.CORDIS_AGENT_MODEL_NAME || ''
const API_KEY =
  env.CORDIS_AGENT_API_KEY || env.CORDIS_AGENT_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY || ''
const BASE_URL = (
  env.CORDIS_AGENT_BASE_URL ||
  env.CORDIS_AGENT_BASE || {
    openai: 'https://api.openai.com/v1',
    deepseek: 'https://api.deepseek.com/v1',
    anthropic: 'https://api.anthropic.com/v1',
  }[PROVIDER] ||
  'https://api.openai.com/v1'
).replace(/\/+$/, '')

const MAX_TOKENS = Number(env.CORDIS_AGENT_MAX_TOKENS) || 4096
const TIMEOUT_MS = Number(env.CORDIS_AGENT_TIMEOUT_MS) || 180000

const IS_ANTHROPIC = PROVIDER === 'anthropic'

/** tool definitions ({name, description, input_schema}) -> wire format */
function wireTools(definitions) {
  if (!Array.isArray(definitions) || definitions.length === 0) return undefined
  if (IS_ANTHROPIC) {
    return definitions.map((d) => ({
      name: d.name,
      description: d.description,
      input_schema: d.input_schema ?? { type: 'object', properties: {} },
    }))
  }
  return definitions.map((d) => ({
    type: 'function',
    function: {
      name: d.name,
      description: d.description,
      parameters: d.input_schema ?? { type: 'object', properties: {} },
    },
  }))
}

function textOf(content) {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : typeof p?.text === 'string' ? p.text : ''))
      .join('')
  }
  return String(content)
}

function parseArgs(raw) {
  if (raw == null) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return { _raw: String(raw) }
  }
}

/** our internal messages -> Anthropic Messages API shape */
function toAnthropic(messages) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => textOf(m.content))
    .join('\n\n')
  const out = []
  for (const m of messages) {
    if (m.role === 'system') continue
    if (m.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: textOf(m.content),
      }
      const last = out[out.length - 1]
      // Anthropic wants consecutive tool results grouped in one user turn.
      if (last && last.role === 'user' && Array.isArray(last.content) && last.content.every((b) => b.type === 'tool_result')) {
        last.content.push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
      continue
    }
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) {
      const blocks = []
      const text = textOf(m.content)
      if (text) blocks.push({ type: 'text', text })
      for (const call of m.tool_calls) {
        blocks.push({
          type: 'tool_use',
          id: call.id,
          name: call.function?.name ?? call.name,
          input: parseArgs(call.function?.arguments ?? call.arguments),
        })
      }
      out.push({ role: 'assistant', content: blocks })
      continue
    }
    out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: textOf(m.content) })
  }
  return { system: system || undefined, messages: out }
}

export class LLM {
  constructor() {
    this.provider = PROVIDER
    this.model = MODEL
    this.baseUrl = BASE_URL
    this.lastUsage = null
    this.calls = 0
  }

  get configured() {
    return Boolean(this.model && API_KEY)
  }

  async chat(messages, tools) {
    const list = Array.isArray(messages) ? messages : []
    const definitions = Array.isArray(tools) ? tools : tools?.definitions ?? []

    if (!MODEL) throw new Error('llm: no model configured (CORDIS_AGENT_MODEL is empty)')
    if (!API_KEY) throw new Error('llm: no API key in the environment (CORDIS_AGENT_API_KEY is empty)')

    const url = IS_ANTHROPIC ? `${BASE_URL}/messages` : `${BASE_URL}/chat/completions`
    const headers = { 'content-type': 'application/json' }

    let body
    if (IS_ANTHROPIC) {
      headers['x-api-key'] = API_KEY
      headers['anthropic-version'] = env.CORDIS_AGENT_ANTHROPIC_VERSION || '2023-06-01'
      const converted = toAnthropic(list)
      body = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        ...(converted.system ? { system: converted.system } : {}),
        messages: converted.messages,
        ...(wireTools(definitions) ? { tools: wireTools(definitions) } : {}),
      }
    } else {
      headers.authorization = `Bearer ${API_KEY}`
      body = {
        model: MODEL,
        messages: list.map((m) => ({
          role: m.role,
          content: m.role === 'assistant' ? m.content ?? null : textOf(m.content),
          ...(m.role === 'tool' ? { tool_call_id: m.tool_call_id } : {}),
          ...(Array.isArray(m.tool_calls) ? { tool_calls: m.tool_calls } : {}),
        })),
        max_tokens: MAX_TOKENS,
        ...(wireTools(definitions) ? { tools: wireTools(definitions), tool_choice: 'auto' } : {}),
      }
    }

    this.calls++
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`llm: ${res.status} ${res.statusText} from ${url} - ${text.slice(0, 500)}`)
    }

    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`llm: non-JSON response from ${url} - ${text.slice(0, 300)}`)
    }

    this.lastUsage = data.usage ?? null
    return IS_ANTHROPIC ? fromAnthropic(data) : fromOpenAI(data)
  }
}

function fromOpenAI(data) {
  const message = data?.choices?.[0]?.message
  if (!message) throw new Error(`llm: no message in response - ${JSON.stringify(data).slice(0, 300)}`)
  return {
    role: 'assistant',
    content: textOf(message.content),
    ...(Array.isArray(message.tool_calls) ? { tool_calls: message.tool_calls } : {}),
  }
}

/** Anthropic content blocks -> the OpenAI-shaped assistant message the
 *  agent loop already understands (name + JSON-string arguments). */
function fromAnthropic(data) {
  const blocks = Array.isArray(data?.content) ? data.content : []
  if (blocks.length === 0) throw new Error(`llm: no content in response - ${JSON.stringify(data).slice(0, 300)}`)
  const text = blocks
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  const toolCalls = blocks
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({
      id: b.id,
      type: 'function',
      function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
    }))
  return {
    role: 'assistant',
    content: text,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  }
}

export function apply(ctx) {
  ctx.provide('llm', new LLM())
  console.log(
    `[llm] active - provider=${PROVIDER} model=${MODEL || '(unset)'} base=${BASE_URL} ` +
      `key=${API_KEY ? 'present' : 'MISSING'} (values never logged)`,
  )
}
