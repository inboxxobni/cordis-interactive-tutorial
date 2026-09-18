import { useStore } from "../store";

export function EventLog() {
  const log = useStore((s) => s.log);
  return (
    <div className="event-log">
      {log.length === 0 && <p className="muted">Events will stream here as a chapter runs — this is the real WebSocket trace, not a script.</p>}
      {log.map((line) => (
        <div key={line.id} className={`event-line kind-${line.kind}`}>
          <span className="event-kind">{line.kind}</span> {line.text}
        </div>
      ))}
    </div>
  );
}
