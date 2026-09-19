import { promptChainFor } from "@cordis-tutorial/shared/chapter-suggestions";
import type { TestCase } from "../src/types.js";
import {
  all,
  anyAgentPluginReachedActive,
  anyFiberFailed,
  configErrorObserved,
  fileWasWritten,
  producedAnswer,
  remountObserved,
  stuckPending,
  toolRanOk,
} from "../src/goals.js";

/**
 * Volume 1 - "Cordis global overview" (chapters 01-15, parts 1-4). Every
 * chain here is the exact promptChainFor() a real user would click through
 * in the UI - the goal is a real, verifiable claim about what that chain
 * should leave behind in the live Context/workspace, not a restatement of
 * the chip text.
 */
export const VOLUME_1_CASES: TestCase[] = [
  { chapter: "01-first-plugin", chain: promptChainFor("01-first-plugin"), goal: all(anyAgentPluginReachedActive(), anyFiberFailed()) },
  { chapter: "02-lifecycle-and-effects", chain: promptChainFor("02-lifecycle-and-effects"), goal: anyAgentPluginReachedActive() },
  { chapter: "03-services", chain: promptChainFor("03-services"), goal: anyAgentPluginReachedActive() },
  { chapter: "04-events", chain: promptChainFor("04-events"), goal: anyAgentPluginReachedActive() },
  { chapter: "05-configuration", chain: promptChainFor("05-configuration"), goal: all(anyAgentPluginReachedActive(), configErrorObserved()) },
  { chapter: "06-composition-and-hmr", chain: promptChainFor("06-composition-and-hmr"), goal: all(remountObserved(), stuckPending()) },
  { chapter: "07-into-the-harness", chain: promptChainFor("07-into-the-harness"), goal: all(anyAgentPluginReachedActive(), toolRanOk("")) },
  { chapter: "08-plugin-forms", chain: promptChainFor("08-plugin-forms"), goal: anyAgentPluginReachedActive() },
  { chapter: "09-build-a-tool", chain: promptChainFor("09-build-a-tool"), goal: all(anyAgentPluginReachedActive(), toolRanOk("")) },
  { chapter: "10-acryl-config", chain: promptChainFor("10-acryl-config"), goal: all(anyAgentPluginReachedActive(), configErrorObserved()) },
  { chapter: "11-package-and-install", chain: promptChainFor("11-package-and-install"), goal: producedAnswer() },
  { chapter: "12-built-in-services", chain: promptChainFor("12-built-in-services"), goal: producedAnswer() },
  {
    chapter: "13-three-role-capability",
    chain: promptChainFor("13-three-role-capability"),
    goal: all(anyAgentPluginReachedActive(), fileWasWritten(/\.mjs$/)),
  },
  { chapter: "14-llm-adapters", chain: promptChainFor("14-llm-adapters"), goal: producedAnswer() },
  { chapter: "15-runtime-inspection-and-install", chain: promptChainFor("15-runtime-inspection-and-install"), goal: producedAnswer() },
];
