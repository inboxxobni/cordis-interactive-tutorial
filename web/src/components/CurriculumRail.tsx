import { ChevronRight } from "lucide-react";
import { useStore } from "../store";
import { Navigator } from "./Navigator";
import type { UiMode } from "../App";

/**
 * Left rail: the Learn/Build mode switch (a local UI affordance only - it
 * never hides anything, it just picks sensible default tabs elsewhere, see
 * App.tsx's handleModeChange) above the permanent, always-visible chapter
 * navigator.
 */
export function CurriculumRail({ mode, onModeChange }: { mode: UiMode; onModeChange: (mode: UiMode) => void }) {
  const chapters = useStore((s) => s.chapters);
  const activeChapter = useStore((s) => s.activeChapter);
  const total = chapters.length;
  const activeIndex = chapters.find((c) => c.id === activeChapter)?.index ?? 0;

  return (
    <aside className="curriculum-rail">
      <div className="mode-switch">
        <button className={mode === "learn" ? "mode-active" : ""} onClick={() => onModeChange("learn")}>
          LEARN
        </button>
        <ChevronRight />
        <button className={mode === "build" ? "mode-active" : ""} onClick={() => onModeChange("build")}>
          BUILD
        </button>
      </div>
      <div className="rail-progress">
        <span>CURRICULUM</span>
        <span>{activeChapter ? `ch. ${activeIndex} / ${total}` : `${total} chapters`}</span>
        <div>
          <i style={{ width: activeChapter ? `${(activeIndex / total) * 100}%` : "0%" }} />
        </div>
      </div>
      <Navigator />
      <div className="rail-footer">
        <span>CORDIS TUTORIAL</span>
      </div>
    </aside>
  );
}
