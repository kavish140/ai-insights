type AdSlotProps = {
  /** AdSense data-ad-slot id, once you have one. */
  slotId?: string;
  format: "leaderboard" | "in-article" | "sidebar";
  label?: string;
};

const sizes: Record<AdSlotProps["format"], string> = {
  leaderboard: "min-h-[90px]",
  "in-article": "min-h-[250px]",
  sidebar: "min-h-[600px]",
};

/**
 * Reserved ad space. Drop your AdSense publisher script into __root.tsx and
 * pass the slot id here to activate a placement.
 */
export function AdSlot({ slotId, format, label = "Advertisement" }: AdSlotProps) {
  return (
    <aside
      aria-label={label}
      data-ad-format={format}
      data-ad-slot={slotId}
      className={`flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-secondary/60 px-4 py-6 ${sizes[format]}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
    </aside>
  );
}
