import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { SITE } from "@/lib/posts";
import type { SiteSettings } from "@/lib/site-settings";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ReadingSettings } from "./ReadingSettings";

const nav = [
  { to: "/", label: "Home" },
  { to: "/blog", label: "Articles" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader({ site = SITE }: { site?: typeof SITE & Partial<SiteSettings> }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border/80 bg-surface/85 backdrop-blur-xl">
      <div className="header-inner mx-auto flex h-20 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="brand-mark grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-primary-foreground">
            {site.brand_initials ?? "AI"}
          </span>
          <span className="font-display text-base font-semibold tracking-tight">{site.name}</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "nav-link-active" }}
              className="nav-link rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Link to="/blog" className="primary-action ml-4">
            {site.header_cta_label ?? "Start reading"}
            <ArrowUpRight size={16} />
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ReadingSettings />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Toggle menu"
            className="rounded-lg border border-border p-2 text-muted-foreground md:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className="mobile-nav border-t border-border bg-surface px-4 py-3 md:hidden"
        >
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: item.to === "/" }}
              activeProps={{ className: "bg-primary-soft text-primary" }}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
