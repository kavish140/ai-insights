import { BookOpen, Check, Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { useReader } from "./ReaderProvider";
import { defaultReadingSettings } from "@/lib/reading-settings";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";

export function ReadingSettings() {
  const { settings, update, storageMessage } = useReader();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="reader-settings-trigger"
          aria-label="Reading settings"
          title="Reading settings"
        >
          <SlidersHorizontal size={18} />
          <span>Reading settings</span>
        </button>
      </DialogTrigger>
      <DialogContent className="reading-settings-dialog max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle className="flex items-center gap-2">
          <BookOpen size={19} /> Make yourself comfortable
        </DialogTitle>
        <DialogDescription>
          Your reading space, your preferences. Saved on this browser.
        </DialogDescription>
        <fieldset>
          <legend>Appearance</legend>
          <div className="setting-options setting-themes">
            {(
              [
                { value: "light", label: "Light", Icon: Sun },
                { value: "dark", label: "Dark", Icon: Moon },
                { value: "sepia", label: "Sepia", Icon: BookOpen },
                { value: "system", label: "Auto", Icon: Monitor },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                type="button"
                key={value}
                aria-pressed={settings.theme === value}
                onClick={() => update({ theme: value })}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Article typeface</legend>
          <div className="setting-options">
            <button
              aria-pressed={settings.font === "sans"}
              onClick={() => update({ font: "sans" })}
            >
              Modern sans
            </button>
            <button
              className="font-serif"
              aria-pressed={settings.font === "serif"}
              onClick={() => update({ font: "serif" })}
            >
              Classic serif
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>Article text size</legend>
          <div className="setting-options">
            {[16, 18, 20, 22].map((size) => (
              <button
                key={size}
                aria-pressed={settings.size === size}
                onClick={() => update({ size })}
              >
                {size}
                <span className="sr-only"> pixels</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-4">
          <label className="setting-select">
            Line spacing
            <select
              value={settings.spacing}
              onChange={(e) => update({ spacing: e.target.value as "relaxed" | "compact" })}
            >
              <option value="relaxed">Relaxed</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="setting-select">
            Reading width
            <select
              value={settings.width}
              onChange={(e) => update({ width: e.target.value as "focused" | "wide" })}
            >
              <option value="focused">Focused</option>
              <option value="wide">Wide</option>
            </select>
          </label>
        </div>
        <div
          className="reader-preview"
          style={{
            fontFamily: settings.font === "serif" ? "Georgia, serif" : "var(--font-body)",
            fontSize: settings.size,
            lineHeight: settings.spacing === "relaxed" ? 1.85 : 1.55,
          }}
        >
          Good ideas deserve a comfortable place to read.
        </div>
        <label className="setting-toggle">
          <span>
            <strong>Focus mode</strong>
            <small>Hide article sidebars and promotional blocks.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.focus}
            onChange={(e) => update({ focus: e.target.checked })}
          />
        </label>
        <label className="setting-toggle">
          <span>
            <strong>Quiet motion</strong>
            <small>Turn off decorative animations.</small>
          </span>
          <input
            type="checkbox"
            checked={!settings.motion}
            onChange={(e) => update({ motion: !e.target.checked })}
          />
        </label>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Check size={13} /> Applied automatically
          </span>
          <button
            className="text-xs text-primary underline"
            onClick={() => update(defaultReadingSettings)}
          >
            Reset settings
          </button>
        </div>
        {storageMessage && (
          <p role="status" className="text-xs text-muted-foreground">
            {storageMessage}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
