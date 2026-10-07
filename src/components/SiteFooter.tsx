import { Link } from "@tanstack/react-router";
import { SITE, categories as defaultCategories } from "@/lib/posts";
import type { SiteSettings } from "@/lib/site-settings";

export function SiteFooter({
  site = SITE,
  categories = [...defaultCategories],
}: {
  site?: typeof SITE & Partial<SiteSettings>;
  categories?: string[];
}) {
  return (
    <footer className="mt-20 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-primary-foreground">
              {site.brand_initials ?? "AI"}
            </span>
            <span className="font-display text-base font-semibold">{site.name}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {site.description}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">{SITE.domain}</p>
          <div className="mt-3 flex gap-4 text-sm">
            {[
              ["LinkedIn", site.linkedin_url],
              ["YouTube", site.youtube_url],
              ["X", site.x_url],
            ].map(([label, url]) =>
              url ? (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary"
                >
                  {label}
                </a>
              ) : null,
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Topics</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            {categories.map((c) => (
              <li key={c}>
                <Link to="/blog" search={{ category: c }} className="hover:text-foreground">
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Site</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
            <li>
              <Link to="/blog" className="hover:text-foreground">
                All articles
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-foreground">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
            </li>
            <li>
              <Link to="/admin" className="hover:text-foreground">
                Admin
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} {site.name}. {site.footer_note ?? "All rights reserved."}
      </div>
    </footer>
  );
}
