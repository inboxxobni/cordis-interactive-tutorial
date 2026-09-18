import type { ChapterId } from "@cordis-tutorial/shared";
import { Term } from "./Tooltip";

/**
 * Hardcoded per-chapter content, same authoring model as aicodingagent-ts's
 * Theory.tsx (a plain switch, not a data-driven/MDX pipeline) — content
 * drawn from the official Cordis tutorial curriculum and this repo's own
 * chapter source.
 */
export function Theory({ chapter }: { chapter: ChapterId | null }) {
  if (!chapter) {
    return <p className="muted">Pick a chapter to see what it's teaching.</p>;
  }

  switch (chapter) {
    case "01-first-plugin":
      return (
        <div>
          <p>
            A <Term tip="A module Cordis can mount and unmount.">plugin</Term> is usually just a function loaded by the framework:{" "}
            <code>export function apply(ctx) {"{"} ... {"}"}</code>. Cordis calls <code>apply</code> once the{" "}
            <Term tip="The live runtime instance of one plugin application: PENDING, LOADING, ACTIVE, FAILED, UNLOADING, DISPOSED.">fiber</Term> reaches <code>ACTIVE</code> — there's no separate app bootstrap.
          </p>
          <p>Watch the plugin graph: one node appears, goes PENDING → LOADING → ACTIVE. That's the whole lesson.</p>
        </div>
      );
    case "02-lifecycle-and-effects":
      return (
        <div>
          <p>
            Anything that outlives the <code>apply()</code> call — a timer, here — must be acquired inside{" "}
            <Term tip="Register a cleanup-aware effect: execute runs immediately, and the disposer it returns runs when the fiber unloads.">ctx.effect()</Term>{" "}
            and return a disposer. Cordis runs that disposer when the fiber unloads — a leak is an architecture bug, not a polish item.
          </p>
          <p>Watch the event log for effect_acquire, then effect_dispose when you stop the chapter.</p>
        </div>
      );
    case "03-services":
      return (
        <div>
          <p>
            One plugin exposes a capability on <code>ctx</code> with <code>ctx.provide()</code>; another declares it a hard requirement with{" "}
            <code>export const inject = [...]</code>. Load order in the source is <em>not</em> load order in Cordis.
          </p>
          <p>
            A plugin with an unmet <code>inject</code> stays <Term tip="Waiting for required services. This is healthy, not broken.">PENDING</Term> — watch the
            consumer here register PENDING before the provider, then jump to ACTIVE only once the provider does.
          </p>
        </div>
      );
    case "04-events":
      return (
        <div>
          <p>
            <code>ctx.on()</code> registers a listener that Cordis removes automatically when the fiber unloads — unlike a raw timer, no
            manual cleanup needed. <code>ctx.emit()</code> dispatches to every listener across the Context tree.
          </p>
          <p>Watch event_listen fire once at startup, then event_emit fire on an interval as the broadcaster ticks.</p>
        </div>
      );
    case "05-configuration":
      return (
        <div>
          <p>
            A plugin declares a <code>Config</code> object implementing{" "}
            <Term tip="A shared interface for validators (Zod, Valibot, ArkType, or hand-written): one method, config['~standard'].validate(value), returning either {value} or {issues}.">
              Standard Schema
            </Term>
            . Cordis calls it inside its own <code>resolveConfig()</code> before <code>apply()</code> runs — this
            chapter's plugin validator is hand-written (three fields, one method) so the whole interface fits on
            screen, but any Standard-Schema-compatible library works identically.
          </p>
          <p>
            Watch the trace: the first mount gets valid config and reaches ACTIVE. The second gets{" "}
            <code>{"{ greeting: 42 }"}</code> — a real <code>ValidationError</code> is thrown, the fiber goes straight
            to FAILED, and <code>config_error</code> carries the exact message Cordis itself produced.
          </p>
        </div>
      );
    case "06-composition-and-hmr":
      return (
        <div>
          <p>
            Real Cordis hot-reload is <code>fiber.update(newConfig)</code> — the <em>same</em> fiber (same identity,
            same <code>uid</code>) tears down its effects and re-runs <code>apply()</code> with the new config. This
            is different from <code>mount_plugin</code>'s edit-then-remount, which creates a genuinely new fiber for
            a genuinely new file version — the right model when the agent rewrites a file, not when a config value
            changes on an already-loaded plugin.
          </p>
          <p>Watch the pluginId in the trace: it doesn't change across the reload, only the state does.</p>
        </div>
      );
    case "07-into-the-harness":
      return (
        <div>
          <p>
            A real DeepSeek Harness tool is "a consumer of <code>ctx.tools</code>, not a Cordis primitive" — this
            chapter builds the minimal seam directly: a <code>tools</code> service any plugin can{" "}
            <code>inject</code>, and a second plugin that registers a callable tool against it, then calls it. A real
            Harness swaps in its own richer tool registry; the registration shape a plugin author writes is the same.
          </p>
        </div>
      );
    case "08-plugin-forms":
      return (
        <div>
          <p>
            Cordis accepts a plugin as a <strong>function</strong>, an <strong>object literal</strong>, or a{" "}
            <strong>class</strong>. All three mounted here do the same thing, identically — the class form extends{" "}
            <Term tip="A base class whose constructor calls super(ctx, name), which registers the instance as ctx.<name> automatically.">
              Service
            </Term>
            , which is the shape to reach for once a plugin's whole point is to <em>provide</em> a named capability
            (see chapter 13).
          </p>
          <p>Use the function form until you need that — it's the default for a reason.</p>
        </div>
      );
    case "09-build-a-tool":
      return (
        <div>
          <p>
            A real ACRYL tool is <code>defineTool()</code> registered against an injected <code>tools</code> service
            — <code>export const inject = ['tools']</code>, then{" "}
            <code>ctx.tools.register(defineTool({"{"} name, parameters, output, execute {"}"}))</code>. This chapter
            re-implements that exact contract minimally (matching{" "}
            <code>runtime/acryl-harness-runtime/src/plugin-acryl-workspace-status.ts</code> in the real ACRYL repo)
            so the sandbox stays dependency-free while teaching the real shape.
          </p>
          <p>
            <code>output.schema</code> declares the canonical return type; <code>output.render</code> converts it to
            model-facing content. Watch the trace: the tool is registered, then actually called.
          </p>
        </div>
      );
    case "10-acryl-config":
      return (
        <div>
          <p>
            ACRYL's real <code>Config</code> convention is <strong>Schemastery</strong> (
            <code>@deepseek-ai/schemastery</code>), not the npm <em>zod</em> package — grep the whole ACRYL repo and
            there is no <code>from 'zod'</code> import anywhere. <code>apps/acryl-desktop/src/updates.ts</code>{" "}
            imports Schemastery aliased as <code>z</code>, which reads like zod but isn't. Schemastery implements
            Standard Schema natively (its own <code>Schema.prototype['~standard']</code>), so it's a drop-in swap
            for chapter 5's hand-written validator, not a different mechanism underneath.
          </p>
          <p>
            Three design principles, demonstrated for real here, not just stated: don't hardcode tunables (
            <code>intervalMs</code> is configurable), fail loudly on invalid config (a real{" "}
            <code>ValidationError</code> below, not a narrated one), and it works with HMR (chapter 6's{" "}
            <code>fiber.update()</code> re-validates on every reload).
          </p>
        </div>
      );
    case "11-package-and-install":
      return (
        <div>
          <p>
            Two manifests matter: the <strong>bundle manifest</strong> (a package's own <code>dsh.bundle</code>{" "}
            field, declaring what it contributes) and the <strong>profile manifest</strong> (
            <code>package.json</code>'s <code>dsh.profile.bundles</code> ordered list, deciding what's actually
            loaded and in what order). Installing changes both: the package lands via pnpm, then the profile
            manifest gets appended to.
          </p>
          <p>
            Loading order follows the profile manifest's list, not install order. A surface bundle (a Web/Desktop
            entry point) can register its own CLI command by declaring one in its bundle manifest. Installing
            straight from a GitHub URL has a catch: pnpm needs the package already built — a build script your local
            pnpm skips by default (build-script approval) will leave a source-only, unusable install.
          </p>
          <p className="muted">
            Reference only — a real install needs pnpm and a real profile directory; this sandbox's{" "}
            <code>mount_plugin</code> deliberately sidesteps this whole path for local iteration. See the ACRYL
            repo's <code>.claude/skills/cordis-plugin-quickstart/</code> skill for the actual local-first equivalent.
          </p>
        </div>
      );
    case "12-built-in-services":
      return (
        <div>
          <p>
            Every ACRYL instance — even a blank one — has real named services already mounted on <code>ctx</code>.
            Three confirmed by reading the actual ACRYL source (not a generic list):
          </p>
          <ul>
            <li>
              <code>ctx.acrAgentControl</code> — <code>runtime/acryl-control/src/agent/agent-control.ts</code>{" "}
              (definition + provider), consumed via <code>inject: ['acrAgentControl']</code> in{" "}
              <code>runtime/acryl-control/src/agent/providers/factory.ts</code>.
            </li>
            <li>
              <code>ctx.acrRuntimeArchitecture</code> — <code>runtime/acryl-control/src/architecture/provider.ts</code>.
            </li>
            <li>
              <code>ctx.acrPluginLifecycle</code> — <code>runtime/acryl-control/src/plugin/provider.ts</code>,
              consumed in <code>runtime/acryl-harness-runtime/src/plugin-lifecycle.ts</code>.
            </li>
          </ul>
          <p className="muted">
            Reference only. The Harness docs point at a generated per-service reference (
            <code>reference/subsystems/core</code>) — treat that generated page and each service's own TypeScript
            interface as authoritative; don't maintain a second static list by hand.
          </p>
        </div>
      );
    case "13-three-role-capability":
      return (
        <div>
          <p>
            Split a capability into a <strong>Service Definition</strong> (the abstract Cordis service interface), a{" "}
            <strong>Service Provider</strong> (a concrete implementation), and a <strong>Consumer</strong> (injects
            and uses it) — <em>only</em> when the roles genuinely need to evolve independently. This chapter mirrors
            ACRYL's real <code>acrAgentControl</code> split (definition + provider in one file, consumer in
            another) at teaching scale: an <code>UppercaseService</code> definition, a local provider, and a tool
            that injects and calls it.
          </p>
          <p>
            The payoff: a different provider package could implement the same service differently, and neither the
            definition nor the consumer would need to change. "Do not split preemptively" — a plugin with one
            effect and no external consumers doesn't need this.
          </p>
        </div>
      );
    case "14-llm-adapters":
      return (
        <div>
          <p>
            An LLM adapter extends <code>LlmAdapter</code> and implements one async generator:{" "}
            <code>async *stream(options: GenerateOptions): AsyncIterable{"<StreamChunk>"}</code>, translating
            Harness's provider-neutral request into a real API call and translating the response back. Chunk kinds:{" "}
            <code>block-start</code>/<code>block-end</code> (frame a content block), <code>text-delta</code>,{" "}
            <code>tool-call-delta</code> (raw JSON arguments, streamed progressively), <code>usage</code>, and{" "}
            <code>finish</code>.
          </p>
          <p>
            Every provider HTTP request must merge <code>attributionHeaders()</code> and forward{" "}
            <code>options.signal</code>; failures are thrown as <code>LlmError</code> with a stable code, not a
            generic <code>Error</code>.
          </p>
          <p className="muted">
            Reference only — a real adapter needs the full Harness LLM plumbing (provider registration,{" "}
            <code>GenerateOptions</code>, the real <code>StreamChunk</code> types) this sandbox doesn't pull in.
          </p>
        </div>
      );
    case "15-runtime-inspection-and-install":
      return (
        <div>
          <p>
            Two real ACRYL/Harness packages sound like they might do what this tutorial's <code>mount_plugin</code>{" "}
            does. Neither actually does:
          </p>
          <p>
            <code>@deepseek-ai/dsh-tool-cordis</code> is <strong>read-only inspection</strong> — it lists available
            services/providers and their exact method signatures so a model can build context before writing code.
            It cannot mount, unmount, or invoke anything.
          </p>
          <p>
            The <strong>Plugin Manager</strong> (<code>@deepseek-ai/dsh-plugin-manager</code>) makes{" "}
            <strong>persistent, session-wide</strong> changes — it edits <code>cordis.patch.yml</code> and{" "}
            <code>package.json</code>'s bundle list directly, and those changes affect every session sharing that
            profile immediately. Its own docs are explicit: no ephemeral/in-memory mounting capability.
          </p>
          <p>
            This tutorial's <code>mount_plugin</code> fills the gap neither covers: mount a plugin for{" "}
            <em>this session only</em>, no persistent config write, gone if you don't graduate it.
          </p>
        </div>
      );
    default:
      return <p className="muted">This chapter isn't implemented yet — see the corresponding file under server/src/chapters/.</p>;
  }
}
