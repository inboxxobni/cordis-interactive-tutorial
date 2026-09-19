import { promptChainFor } from "@cordis-tutorial/shared/chapter-suggestions";
import type { TestCase } from "../src/types.js";
import { all, fileWasWritten, producedAnswer, stuckPending, toolRanOk } from "../src/goals.js";

/**
 * Volume 2 - "Let's build our own Coding Agent Harness from scratch"
 * (chapters 16-24, parts 5-6). This is the flagship volume for this
 * harness: it is a real rehearsal of ACRYL's own self-building capability,
 * so its goals check for the real files landing in workspace/ and the real
 * agentLoop fiber's dependency-driven PENDING->ACTIVE progression - not
 * prose describing that it happened.
 */
export const VOLUME_2_CASES: TestCase[] = [
  { chapter: "16-what-is-an-agent", chain: promptChainFor("16-what-is-an-agent"), goal: producedAnswer() },
  {
    chapter: "17-the-loop",
    chain: promptChainFor("17-the-loop"),
    goal: all(fileWasWritten(/agent-loop\.mjs$/), stuckPending(/agent-loop/)),
  },
  { chapter: "18-tools", chain: promptChainFor("18-tools"), goal: fileWasWritten(/tools\.mjs$/) },
  { chapter: "19-context-window", chain: promptChainFor("19-context-window"), goal: fileWasWritten(/context-window\.mjs$/) },
  { chapter: "20-cache-and-compact", chain: promptChainFor("20-cache-and-compact"), goal: fileWasWritten(/compaction\.mjs$/) },
  { chapter: "21-system-prompt", chain: promptChainFor("21-system-prompt"), goal: fileWasWritten(/system-prompt\.mjs$/) },
  {
    chapter: "22-providers",
    chain: promptChainFor("22-providers"),
    // The real payoff chip in this volume: every dependency should now be
    // satisfied, so the SAME fiber that stayed PENDING through 17-21
    // (matched the same way) must now be observed reaching ACTIVE.
    goal: {
      description: "agentLoop's fiber flips from PENDING to ACTIVE once llm.mjs is mounted",
      check(ctx) {
        const changes = ctx.events.filter((e): e is Extract<typeof e, { type: "fiber_state_change" }> => e.type === "fiber_state_change" && /agent-loop/i.test(e.pluginId));
        const reachedActive = changes.some((e) => e.to === "ACTIVE");
        return reachedActive
          ? { passed: true, details: `agentLoop reached ACTIVE (${changes.map((c) => `${c.from ?? "?"}->${c.to}`).join(", ")})` }
          : { passed: false, details: `agentLoop never reached ACTIVE (${changes.map((c) => `${c.from ?? "?"}->${c.to}`).join(", ") || "no matching fiber_state_change"})` };
      },
    },
  },
  {
    chapter: "23-the-harness",
    chain: promptChainFor("23-the-harness"),
    goal: toolRanOk("run_workspace_agent_turn"),
  },
  { chapter: "24-this-app", chain: promptChainFor("24-this-app"), goal: producedAnswer() },
];
