type AdSlotProps = {
  /** Reserved for a future AdSense integration. */
  slotId?: string;
  format: "leaderboard" | "in-article" | "sidebar";
  label?: string;
};

/**
 * SiteNova house ads occupy all placements while AdSense approval is pending.
 * Replace this creative with the approved ad integration when it is ready.
 */
export function AdSlot({ slotId, format, label = "Advertisement" }: AdSlotProps) {
  return (
    <aside aria-label={label} data-ad-format={format} data-ad-slot={slotId} className="w-full">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <a
        href={`https://sitenova.dev/?utm_source=ai_insights&utm_medium=house_ad&utm_campaign=adsense_pending&utm_content=${format}`}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`sitenova-ad sitenova-ad--${format}`}
        aria-label="Visit SiteNova for custom web design and development (opens in a new tab)"
      >
        <span className="sitenova-ad__brand">
          <img src="/images/sitenova-logo.svg" alt="" width="36" height="36" />
          <span>
            Site<span className="sitenova-ad__accent">Nova</span>
          </span>
        </span>
        <span className="sitenova-ad__copy">
          <span className="sitenova-ad__eyebrow">Web design & development</span>
          <span className="sitenova-ad__headline">
            Your next big idea.
            <br />
            <span className="sitenova-ad__accent">Your next great website.</span>
          </span>
          <span className="sitenova-ad__description">
            Fast, mobile-friendly websites built for your business.
          </span>
        </span>
        {format !== "leaderboard" && (
          <span className="sitenova-ad__preview" aria-hidden="true">
            <span className="sitenova-ad__browser">
              <i />
              <i />
              <i />
            </span>
            <span className="sitenova-ad__preview-body">
              <span className="sitenova-ad__preview-tag">BUILT FOR YOU</span>
              <span className="sitenova-ad__preview-title">
                Make your
                <br />
                business stand out.
              </span>
              <span className="sitenova-ad__preview-line" />
              <span className="sitenova-ad__preview-button" />
              <span className="sitenova-ad__preview-cards">
                <i />
                <i />
                <i />
              </span>
            </span>
          </span>
        )}
        <span className="sitenova-ad__action">
          <span className="sitenova-ad__cta">
            Explore SiteNova <span aria-hidden="true">↗</span>
          </span>
          <span className="sitenova-ad__domain">sitenova.dev</span>
        </span>
      </a>
    </aside>
  );
}
