# AI Insights Hub

SSR blog powered by TanStack Start, Supabase, and Cloudflare Workers.

## Deployment

Repository: https://github.com/kavish140/ai-insights

In Cloudflare, open Workers & Pages, create a Worker, and import this repository.

- Worker name: `ai-insights`
- Production branch: `main`
- Root directory: repository root
- Build command: `npm ci && npm run build`
- Deploy command: `npm run deploy`
- Node version: 22 or newer

The build generates the server and assets in `.output`, with the final deployment
configuration at `.output/server/wrangler.json`. The application renders pages on
each request; blog content does not require a rebuild after publishing.

The project URL and browser-safe Supabase publishable key are in `wrangler.jsonc`.
No service-role/secret key is used by this app. Row Level Security protects writes
and unpublished articles. Do not replace the publishable key with a secret key.

After deploying, open the Worker Settings, Domains & Routes, Add Custom Domain,
and enter `ai-insights.sitenova.dev`. The `sitenova.dev` zone must be active in the
same Cloudflare account. Cloudflare creates the DNS record and TLS certificate.
Do not add an SPA fallback or a cache-everything rule for application HTML.

## Supabase setup

1. Run `supabase/migrations/202610050001_articles.sql` in the SQL Editor once.
2. In Authentication > Users > Add user, create `kavishganatra5@gmail.com` with
   your chosen password and Auto Confirm User enabled.
3. Run `supabase/admin-access.sql` in the SQL Editor to grant that user editor access.
4. Set Authentication > URL Configuration > Site URL to
   `https://ai-insights.sitenova.dev`. Disable public signups if this project is only
   used for your private editor.
5. Open `https://ai-insights.sitenova.dev/admin` and sign in. Save a draft or choose
   Published and save to make the article visible. Future-dated posts remain hidden
   until their publication date (UTC).

Public pages only query published posts. Article HTML is sanitized before rendering.
`/sitemap.xml` is generated from the current published articles, with a five-minute
cache header. Admin uses browser Supabase sessions; no auth session is needed for
public SSR pages.

## Local verification

Copy `.env.example` to `.env.local` and add the publishable key for Vite development.
For a local Wrangler preview, put the same values in `.dev.vars` (both are ignored).

```sh
npm ci
npm run check
npm run build
node scripts/smoke-ssr.mjs
npm run dev
```

The smoke check runs the production Worker against a local API fixture. It checks
SSR article HTML, metadata, sanitization, the sitemap, a 404, the admin shell, and
the empty homepage. It does not write to your Supabase project.

The public site includes search, sorting, pagination, a beginner reading path,
article navigation, workflow checklists and editorial/privacy pages. Contact and
newsletter forms use Resend and remain explicitly unavailable until configured.
SiteNova house advertisements follow editorial content.
See `docs/public-site-plan.md` for the implementation phases and
`docs/email-setup.md` for activation instructions.

## Basic admin

`/admin` opens the publishing dashboard after sign-in with a designated admin account.
It includes post totals and latest posts; search, category/status filters and sorting;
publish/unpublish, live links and confirmed deletion; an HTML correction editor with
featured-image selection; category creation, renaming and deletion; a media library
with uploads, credits, alt text and unused-image deletion; and public site settings.
MCP remains the normal publishing workflow. Revision checks prevent overwriting newer edits.

Apply `supabase/migrations/20261007043618_basic_admin.sql` after the existing migrations
before deploying this admin. It adds categories and settings with RLS, a designated-admin
access check, and admin-only media storage policies. Category renames update associated posts;
categories still used by posts and images still referenced by posts cannot be deleted.
Uploads accept PNG/JPEG/WebP up to 4 MiB and use the same hashed paths as MCP uploads.
Deploy the updated `blog-mcp` function alongside the app so `get_site_context` and
article schemas support the managed categories. The generated dashboard deployment file
is refreshed with `node scripts/prepare-mcp-dashboard.mjs`.

Settings update the public header/footer, homepage tagline and description, and default
site metadata. The canonical domain and page-specific editorial metadata remain defined
in code. The default author applies to new emergency drafts.

## Good admin

The next tier adds MCP Activity and SEO sections, weekly/monthly publication totals,
scheduled posts, category distribution, recent MCP-created posts, post duplication,
sanitized previews and revision snapshots, and image dimensions/WebP optimization.
Manual future-dated publication schedules visibility for that UTC date without a cron job.
MCP retains its existing rule against future-dated publication.

Run `supabase/migrations/20261007051335_good_admin.sql` once, after the Basic admin
migration, in project `gutvbukqlqutjwlbmfpr`. It adds admin-readable operation logs,
immutable revision snapshots, and optional image dimensions. Existing posts receive
a baseline snapshot; versions from before this migration cannot be reconstructed.
Deleted posts retain their snapshots for auditing.

Regenerate `supabase/dashboard/blog-mcp.ts` with `node scripts/prepare-mcp-dashboard.mjs`
and deploy it to the existing `blog-mcp` function. Keep its existing authentication
configuration. `/health` reports version `2.1.0`, database availability, and whether
operation logging is configured. Success/failure history starts with this deployment;
the earlier database publishing audit remains visible. Logs redact image base64 and
credential fields. Failed supported operations retry the exact original arguments,
UUID and revision after admin confirmation; stale revisions still fail. Image uploads
must be retried with their original bytes because logs do not retain files.

Admin-only server functions validate the current Supabase user and designated-admin
access before preview, health, live SEO or retry actions. Preview uses public-page
HTML sanitization. Loading a revision creates unsaved draft corrections, requiring
review and save; it cannot silently republish an old version. WebP optimization adds
a smaller copy while keeping the source file and existing article references.
SEO reports local metadata/image/internal-link issues, with explicit deployed-site
checks for canonical URLs, BlogPosting data and sitemap status.

## Blog MCP

The Supabase Edge Function `blog-mcp` lets Claude manage drafts and publish on
explicit request. It is public and unauthenticated, as requested. See
`supabase/functions/blog-mcp/README.md` for tools, manual deployment, and checks.
The separate server package owns its pinned dependencies and lockfile; the
website build does not bundle or deploy this function.

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/106b7ec1-d980-4082-bcb6-184587f1d25c).

This checkout was exported from Lovable and is now published to `kavish140/ai-insights`.
To keep Lovable synchronized, select this repository in the Lovable project's GitHub
settings. Creating a new repository does not automatically change its connection.
Avoid rewriting any history already published on a connected branch.
