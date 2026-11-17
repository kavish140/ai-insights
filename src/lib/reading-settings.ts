export type ReadingSettings = {
  theme: "system" | "light" | "dark" | "sepia";
  font: "sans" | "serif";
  size: number;
  spacing: "relaxed" | "compact";
  width: "focused" | "wide";
  focus: boolean;
  motion: boolean;
};

export const readingSettingsKey = "ai-insights:reading-settings:v1";
export const defaultReadingSettings: ReadingSettings = {
  theme: "system",
  font: "sans",
  size: 18,
  spacing: "relaxed",
  width: "focused",
  focus: false,
  motion: true,
};

export function parseReadingSettings(raw: string | null): ReadingSettings {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return { ...defaultReadingSettings };
    return {
      theme: ["system", "light", "dark", "sepia"].includes(value.theme) ? value.theme : "system",
      font: value.font === "serif" ? "serif" : "sans",
      size: [16, 18, 20, 22].includes(value.size) ? value.size : 18,
      spacing: value.spacing === "compact" ? "compact" : "relaxed",
      width: value.width === "wide" ? "wide" : "focused",
      focus: value.focus === true,
      motion: value.motion !== false,
    };
  } catch {
    return { ...defaultReadingSettings };
  }
}

// Runs before the page paints, avoiding a bright flash for returning dark-mode readers.
export const readingBootstrap = `(()=>{try{const s=JSON.parse(localStorage.getItem("${readingSettingsKey}")||"{}")||{};const r=document.documentElement;const t=["light","dark","sepia"].includes(s.theme)?s.theme:"system";r.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;r.classList.toggle("dark",r.dataset.theme==="dark");r.dataset.readerFont=s.font==="serif"?"serif":"sans";r.dataset.readerSpacing=s.spacing==="compact"?"compact":"relaxed";r.dataset.readerWidth=s.width==="wide"?"wide":"focused";r.dataset.readerFocus=String(s.focus===true);r.dataset.readerMotion=String(s.motion!==false);r.style.setProperty("--reader-size",([16,18,20,22].includes(s.size)?s.size:18)+"px")}catch{}})();`;

export type ReadingItem = {
  slug: string;
  title: string;
  category: string;
  minutes: number;
  progress: number;
};

export function parseReadingList(raw: string | null): ReadingItem[] {
  try {
    const items: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items
      .filter((item): item is ReadingItem => {
        if (
          !item ||
          typeof item.slug !== "string" ||
          !item.slug ||
          item.slug.length > 200 ||
          typeof item.title !== "string" ||
          item.title.length > 500 ||
          typeof item.category !== "string" ||
          item.category.length > 100 ||
          !Number.isFinite(item.minutes) ||
          item.minutes < 0 ||
          !Number.isFinite(item.progress) ||
          item.progress < 0 ||
          item.progress > 100 ||
          seen.has(item.slug)
        )
          return false;
        seen.add(item.slug);
        return true;
      })
      .slice(0, 100);
  } catch {
    return [];
  }
}
