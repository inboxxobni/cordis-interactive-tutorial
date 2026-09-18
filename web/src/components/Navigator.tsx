import { PARTS, type ChapterInfo } from "@cordis-tutorial/shared";
import { useStore } from "../store";

/**
 * The whole curriculum, always visible, always in the same place - a
 * permanent sidebar, not a button you have to discover and click to find
 * out navigation exists at all.
 */
export function Navigator() {
  const chapters = useStore((s) => s.chapters);
  const activeChapter = useStore((s) => s.activeChapter);
  const chapterRunning = useStore((s) => s.chapterRunning);
  const connected = useStore((s) => s.connected);
  const runChapter = useStore((s) => s.runChapter);

  const byPart = new Map<string, ChapterInfo[]>();
  for (const c of chapters) {
    const list = byPart.get(c.part) ?? [];
    list.push(c);
    byPart.set(c.part, list);
  }

  return (
    <nav className="navigator">
      <h2>All chapters</h2>
      {PARTS.map((part) => {
        const list = (byPart.get(part.id) ?? []).sort((a, b) => a.index - b.index);
        if (list.length === 0) return null;
        return (
          <div key={part.id} className="nav-part">
            <h3>{part.title}</h3>
            <ol>
              {list.map((c) => (
                <li key={c.id} className={c.id === activeChapter ? "active" : ""}>
                  <button
                    disabled={!connected || (chapterRunning && c.id !== activeChapter)}
                    title={c.summary}
                    onClick={() => runChapter(c.id)}
                  >
                    <span className="nav-index">{c.index}</span>
                    <span className="nav-title">{c.title}</span>
                    {!c.runnable && <span className="nav-badge">ref</span>}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </nav>
  );
}
