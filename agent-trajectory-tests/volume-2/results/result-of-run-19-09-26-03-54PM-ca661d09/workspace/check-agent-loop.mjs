export const name = 'check-agent-loop'
export const inject = ['agentLoop', 'tools', 'llm', 'systemPrompt']

// Throwaway check: drive ONE real turn through the mounted agentLoop and
// assert on the trace it actually returned. Its own fiber state is the
// evidence - ACTIVE means every assertion below held against a real run.
export async function apply(ctx) {
  const fail = (msg) => {
    throw new Error(`check-agent-loop: ${msg}`)
  }

  const task =
    'Call list_files on "." and then reply with exactly one short sentence giving the number of entries you saw. Do not write any files.'

  const trace = await ctx.agentLoop.runTurn(task)
  if (!trace || !Array.isArray(trace.messages)) fail('runTurn returned no messages array')

  // Shape of the transcript the loop actually built.
  if (trace.messages[0]?.role !== 'system') fail('first message is not the system prompt')
  if (!String(trace.messages[0].content).includes('list_files')) fail('system prompt lacks the live tool list')
  if (trace.messages[1]?.role !== 'user' || trace.messages[1].content !== task) fail('task not pushed as the user message')

  // It must have really executed at least one tool, with the real result fed back.
  if (!Array.isArray(trace.steps) || trace.steps.length === 0) fail('no tool was executed during the turn')
  const call = trace.steps[0]
  if (call.tool !== 'list_files') fail(`expected list_files first, got ${call.tool}`)
  if (typeof call.result !== 'string' || !call.result.includes('agent-loop.mjs')) {
    fail(`tool result does not look like a real directory listing: ${String(call.result).slice(0, 80)}`)
  }

  // Every tool result must be in the transcript as a role:'tool' message.
  const toolMessages = trace.messages.filter((m) => m.role === 'tool')
  if (toolMessages.length !== trace.steps.length) fail('tool steps and role:tool messages disagree')

  // The final assistant message must be tool-call free, or we did not stop.
  const last = trace.messages[trace.messages.length - 1]
  if (last.role !== 'assistant') fail(`last message is ${last.role}, not assistant`)
  if (Array.isArray(last.tool_calls) && last.tool_calls.length) fail('loop stopped while a tool call was pending')
  if (!String(last.content || '').trim()) fail('final assistant message is empty')
  if (!trace.done) fail(`turn did not finish cleanly: ${trace.reason}`)

  console.log(
    `[check-agent-loop] ok: ${trace.steps.length} tool step(s) [${trace.steps
      .map((s) => s.tool)
      .join(', ')}], ${trace.messages.length} messages, llm calls=${ctx.llm.calls}`,
  )
  console.log(`[check-agent-loop] final answer: ${String(last.content).trim().slice(0, 200)}`)
}
