import type { ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  Tags,
  Images,
  Settings2,
  ExternalLink,
  Activity,
  SearchCheck,
  Mail,
  ArrowUpRight,
  Sun,
  Moon,
  ChevronRight,
} from "lucide-react";
import { useReader } from "@/components/ReaderProvider";

const sections = [
  {
    name: "Overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "Publishing",
    description: "A clear view of your content, featured story, and publishing activity.",
  },
  {
    name: "Posts",
    label: "All posts",
    icon: FileText,
    group: "Publishing",
    description: "Find, preview, and manage every article in your publication.",
  },
  {
    name: "Content",
    label: "Content health",
    icon: FileText,
    group: "Publishing",
    description: "Review your archive and find articles that need attention.",
  },
  {
    name: "Media",
    label: "Media library",
    icon: Images,
    group: "Publishing",
    description: "Manage the images and credits that bring your stories to life.",
  },
  {
    name: "Categories",
    label: "Categories",
    icon: Tags,
    group: "Publishing",
    description: "Organize your publication into useful topics.",
  },
  {
    name: "Tags",
    label: "Tags",
    icon: Tags,
    group: "Publishing",
    description: "Keep article topics and reader interests organized.",
  },
  {
    name: "Readers",
    label: "Reader insights",
    icon: Activity,
    group: "Audience",
    description: "Understand what visitors read and how they engage.",
  },
  {
    name: "Subscribers",
    label: "Subscribers",
    icon: Mail,
    group: "Audience",
    description: "Manage the people who follow your publication.",
  },
  {
    name: "SEO",
    label: "Search & SEO",
    icon: SearchCheck,
    group: "Audience",
    description: "Review discoverability, metadata, and search readiness.",
  },
  {
    name: "MCP Activity",
    label: "MCP activity",
    icon: Activity,
    group: "Workspace",
    description: "Review automated publishing operations and their results.",
  },
  {
    name: "System",
    label: "System",
    icon: Settings2,
    group: "Workspace",
    description: "Review publishing controls and system diagnostics.",
  },
  {
    name: "Settings",
    label: "Site settings",
    icon: Settings2,
    group: "Workspace",
    description: "Make your publication feel like your own.",
  },
] as const;
export type AdminTab = (typeof sections)[number]["name"] | "Editor";

export function AdminThemeToggle() {
  const { update } = useReader();
  return (
    <button
      type="button"
      className="admin-icon-button"
      aria-label="Toggle light or dark theme"
      onClick={() =>
        update({ theme: document.documentElement.dataset["theme"] === "dark" ? "light" : "dark" })
      }
    >
      <Sun size={17} className="admin-theme-sun" />
      <Moon size={17} className="admin-theme-moon" />
    </button>
  );
}

export function AdminFrame({
  active,
  busy,
  loading,
  onNavigate,
  counts,
  actions,
  notice,
  children,
}: {
  active: AdminTab;
  busy: boolean;
  loading: boolean;
  onNavigate: (tab: AdminTab) => void;
  counts: { posts: number; drafts: number; media: number };
  actions: ReactNode;
  notice?: ReactNode;
  children: ReactNode;
}) {
  const current = sections.find((section) => section.name === active);
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <a href="/admin" className="admin-brand">
          <span>AI</span>
          <div>
            <strong>AI Insights</strong>
            <small>EDITORIAL WORKSPACE</small>
          </div>
        </a>
        <nav aria-label="Admin sections" className="admin-nav">
          {(["Publishing", "Audience", "Workspace"] as const).map((group) => (
            <div key={group} className="admin-nav-group">
              <p>{group}</p>
              {sections
                .filter((section) => section.group === group)
                .map(({ name, label, icon: Icon }) => (
                  <button
                    key={name}
                    type="button"
                    disabled={busy || loading}
                    aria-current={active === name ? "page" : undefined}
                    onClick={() => onNavigate(name)}
                  >
                    <Icon size={17} />
                    <span>{label}</span>
                    {name === "Posts" && <small>{counts.posts}</small>}
                    {name === "Media" && <small>{counts.media}</small>}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <a href="/" target="_blank" rel="noreferrer">
            View public website <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <a href="/">AI Insights</a>
            <ChevronRight size={13} />
            <span>{current?.label ?? "Article editor"}</span>
          </div>
          <div className="admin-topbar-actions">
            <AdminThemeToggle />
            {actions}
          </div>
        </header>
        <div className="admin-page">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">YOUR PUBLISHING DESK</p>
              <h1>
                {active === "Overview"
                  ? "The bigger picture."
                  : (current?.label ?? "Article editor")}
              </h1>
              <p>
                {current?.description ??
                  "Shape the story, check the details, and publish with confidence."}
              </p>
            </div>
            <a className="admin-site-link" href="/" target="_blank" rel="noreferrer">
              Open website <ExternalLink size={14} />
            </a>
          </div>
          <label className="admin-mobile-nav">
            Workspace section
            <select
              aria-label="Workspace section"
              value={active}
              disabled={busy || loading}
              onChange={(event) => onNavigate(event.target.value as AdminTab)}
            >
              {active === "Editor" && <option value="Editor">Article editor</option>}
              {sections.map((section) => (
                <option key={section.name} value={section.name}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>
          {notice}
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </div>
  );
}
