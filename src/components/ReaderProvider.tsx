import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  defaultReadingSettings,
  parseReadingSettings,
  parseReadingList,
  readingSettingsKey,
  type ReadingItem,
  type ReadingSettings,
} from "@/lib/reading-settings";

const savedKey = "ai-insights:saved:v1";
const recentKey = "ai-insights:recent:v1";
type ReaderContextValue = {
  settings: ReadingSettings;
  update: (next: Partial<ReadingSettings>) => void;
  saved: ReadingItem[];
  recent: ReadingItem[];
  toggleSave: (post: ReadingItem) => void;
  remember: (post: ReadingItem) => void;
  clearRecent: () => void;
  storageMessage: string;
  ready: boolean;
};
const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(defaultReadingSettings);
  const [saved, setSaved] = useState<ReadingItem[]>([]);
  const [recent, setRecent] = useState<ReadingItem[]>([]);
  const [ready, setReady] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const remember = useCallback(
    (post: ReadingItem) =>
      setRecent((previous) =>
        [post, ...previous.filter((item) => item.slug !== post.slug)].slice(0, 12),
      ),
    [],
  );
  const toggleSave = useCallback(
    (post: ReadingItem) =>
      setSaved((previous) =>
        previous.some((item) => item.slug === post.slug)
          ? previous.filter((item) => item.slug !== post.slug)
          : [post, ...previous].slice(0, 100),
      ),
    [],
  );
  useEffect(() => {
    function read() {
      try {
        setSettings(parseReadingSettings(localStorage.getItem(readingSettingsKey)));
        setSaved(parseReadingList(localStorage.getItem(savedKey)));
        setRecent(parseReadingList(localStorage.getItem(recentKey)));
      } catch {
        setStorageMessage("Settings and saved articles will last for this visit only.");
      }
      setReady(true);
    }
    read();
    const sync = (event: StorageEvent) => {
      if ([readingSettingsKey, savedKey, recentKey, null].includes(event.key)) read();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    function apply() {
      const root = document.documentElement;
      root.dataset["theme"] =
        settings.theme === "system" ? (media.matches ? "dark" : "light") : settings.theme;
      root.classList.toggle("dark", root.dataset["theme"] === "dark");
      root.dataset["readerFont"] = settings.font;
      root.dataset["readerSpacing"] = settings.spacing;
      root.dataset["readerWidth"] = settings.width;
      root.dataset["readerFocus"] = String(settings.focus);
      root.dataset["readerMotion"] = String(settings.motion);
      root.style.setProperty("--reader-size", `${settings.size}px`);
    }
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(readingSettingsKey, JSON.stringify(settings));
      localStorage.setItem(savedKey, JSON.stringify(saved));
      localStorage.setItem(recentKey, JSON.stringify(recent));
    } catch {
      setStorageMessage("Settings and saved articles will last for this visit only.");
    }
  }, [settings, saved, recent, ready]);

  return (
    <ReaderContext.Provider
      value={{
        settings,
        saved,
        recent,
        storageMessage,
        ready,
        update: (next) => setSettings((previous) => ({ ...previous, ...next })),
        toggleSave,
        remember,
        clearRecent: () => setRecent([]),
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useReader() {
  const context = useContext(ReaderContext);
  if (!context) throw new Error("Reading controls need ReaderProvider.");
  return context;
}
