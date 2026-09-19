// api-probe.mjs - diagnostic only (retired from probing): reports how this
// process is configured WITHOUT ever printing the key.
// Expect: ACTIVE; logs provider/model/base/key-presence.
export const name = 'api-probe'

export function apply() {
  const env = process.env
  const key =
    env.CORDIS_AGENT_API_KEY || env.CORDIS_AGENT_KEY || env.OPENAI_API_KEY || env.DEEPSEEK_API_KEY
  console.log(
    `[api-probe] provider=${env.CORDIS_AGENT_PROVIDER ?? '(unset)'} ` +
      `model=${env.CORDIS_AGENT_MODEL ?? env.CORDIS_AGENT_MODEL_NAME ?? '(unset)'} ` +
      `base=${env.CORDIS_AGENT_BASE_URL ?? env.CORDIS_AGENT_BASE ?? '(provider default)'} ` +
      `key=${key ? 'present' : 'MISSING'}`,
  )
}
