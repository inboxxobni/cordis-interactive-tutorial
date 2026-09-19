import { useEffect, useState } from "react";
import { useStore } from "./store";
import { Header, type ThemeMode } from "./components/Header";
import { CurriculumRail } from "./components/CurriculumRail";
import { Workbench } from "./components/Workbench";
import { InspectorRail } from "./components/InspectorRail";

export type UiMode = "learn" | "build";

const THEME_KEY = "cordis-tutorial:theme";

export function App() {
  const connect = useStore((s) => s.connect);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem(THEME_KEY) as ThemeMode | null) ?? "system");
  const [mode, setMode] = useState<UiMode>("learn");

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  return (
    <div className="cordis-app">
      <Header theme={theme} onThemeChange={setTheme} />
      <div className="app-body">
        <CurriculumRail mode={mode} onModeChange={setMode} />
        <Workbench />
        <InspectorRail />
      </div>
    </div>
  );
}
