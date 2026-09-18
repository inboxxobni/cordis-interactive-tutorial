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
}
