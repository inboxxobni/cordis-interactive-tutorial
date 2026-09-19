// Example: config-schemastery
// Teaches:  plugin config the ACRYL way: export a Schemastery `Config`. Cordis
//           validates the config BEFORE apply() runs, so a bad config fails
//           the whole mount with a real ValidationError (nothing half-applied).
//           Defaults fill in missing fields.
// Expect:   valid config ({greeting:"hey"}): ACTIVE.
//           invalid config ({intervalMs: 10}, below min 100): FAILED.
// Docs:     docs/guide/part-08-configuration.md
import Schema from '@deepseek-ai/schemastery'

export const name = 'example-config-schemastery'

export const Config = Schema.object({
  greeting: Schema.string().default('Hello'),
  intervalMs: Schema.number().min(100).max(60_000).step(1).default(5_000),
})

export function apply(ctx, config) {
  console.log(`[example-config] greeting="${config.greeting}" intervalMs=${config.intervalMs}`)
}
