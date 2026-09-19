import { useStore } from "../store";

/**
 * The raw WebSocket trace, real-time. Rendered in two places with the same
 * data and logic - the workbench's bottom dock (compact) and the right
 * rail's Trace inspector tab (fuller) - via `variant`, not two components.
 */
export function EventLog({ variant = "panel" }: { variant?: "dock" | "panel" }) {
  const log = useStore((s) => s.log);
  const lines = variant === "dock" ? log.slice(-60) : log;

  return (
    <div className={`event-log variant-${variant}`}>
      {lines.length === 0 && <p className="muted">Events will stream here as a chapter runs — this is the real WebSocket trace, not a script.</p>}
      {lines.map((line) => (
        <div key={line.id} className={`event-line kind-${line.kind}`}>
          <span className="event-kind">{line.kind}</span> {line.text}
        </div>
      ))}
    </div>
  );
}
