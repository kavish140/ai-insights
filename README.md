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

The Contact form and advertising placements remain placeholders.

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/106b7ec1-d980-4082-bcb6-184587f1d25c).

This checkout was exported from Lovable and is now published to `kavish140/ai-insights`.
To keep Lovable synchronized, select this repository in the Lovable project's GitHub
settings. Creating a new repository does not automatically change its connection.
Avoid rewriting any history already published on a connected branch.
