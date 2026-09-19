import type { ChapterId } from '@cordis-tutorial/shared'
import type { Chapter } from './types.js'
import { chapter as chapter01 } from './01-first-plugin.js'
import { chapter as chapter02 } from './02-lifecycle-and-effects.js'
import { chapter as chapter03 } from './03-services.js'
import { chapter as chapter04 } from './04-events.js'
import { chapter as chapter05 } from './05-configuration.js'
import { chapter as chapter06 } from './06-composition-and-hmr.js'
import { chapter as chapter07 } from './07-into-the-harness.js'
import { chapter as chapter08 } from './08-plugin-forms.js'
import { chapter as chapter09 } from './09-build-a-tool.js'
import { chapter as chapter10 } from './10-acryl-config.js'
import { chapter as chapter11 } from './11-package-and-install.js'
import { chapter as chapter12 } from './12-built-in-services.js'
import { chapter as chapter13 } from './13-three-role-capability.js'
import { chapter as chapter14 } from './14-llm-adapters.js'
import { chapter as chapter15 } from './15-runtime-inspection-and-install.js'
import { chapter as chapter16 } from './16-what-is-an-agent.js'
import { chapter as chapter17 } from './17-the-loop.js'
import { chapter as chapter18 } from './18-tools.js'
import { chapter as chapter19 } from './19-context-window.js'
import { chapter as chapter20 } from './20-cache-and-compact.js'
import { chapter as chapter21 } from './21-system-prompt.js'
import { chapter as chapter22 } from './22-providers.js'
import { chapter as chapter23 } from './23-the-harness.js'
import { chapter as chapter24 } from './24-this-app.js'

export const CHAPTER_RUNNERS: Record<ChapterId, Chapter> = {
  '01-first-plugin': chapter01,
  '02-lifecycle-and-effects': chapter02,
  '03-services': chapter03,
  '04-events': chapter04,
  '05-configuration': chapter05,
  '06-composition-and-hmr': chapter06,
  '07-into-the-harness': chapter07,
  '08-plugin-forms': chapter08,
  '09-build-a-tool': chapter09,
  '10-acryl-config': chapter10,
  '11-package-and-install': chapter11,
  '12-built-in-services': chapter12,
  '13-three-role-capability': chapter13,
  '14-llm-adapters': chapter14,
  '15-runtime-inspection-and-install': chapter15,
  '16-what-is-an-agent': chapter16,
  '17-the-loop': chapter17,
  '18-tools': chapter18,
  '19-context-window': chapter19,
  '20-cache-and-compact': chapter20,
  '21-system-prompt': chapter21,
  '22-providers': chapter22,
  '23-the-harness': chapter23,
  '24-this-app': chapter24,
}
