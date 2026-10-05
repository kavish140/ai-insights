# AI Insights blog MCP v2

This is a public, unauthenticated Streamable HTTP MCP endpoint, as requested.
Claude and Supabase accounts do not need to match. Anyone who knows the endpoint
can read drafts and use its write tools. `confirmed: true` communicates client
intent; it does not verify human identity. The website's existing Auth and RLS
policies still apply to website clients.

## Manual deployment

1. Run `supabase/migrations/20261005170811_mcp_images_v2.sql` once in the project's
   SQL Editor, after the original articles and v1 MCP migrations. Do not rerun v1.
2. Create a Storage bucket named `blog-images`, Public enabled, maximum file size
   4 MiB (4,194,304 bytes), allowed MIME types `image/png`, `image/jpeg`, `image/webp`.
   No public insert/update/delete policies are needed: only the function's server
   credential uploads files. Bucket creation is separate from the SQL migration.
3. Edit the existing Edge Function named `blog-mcp` via the dashboard editor.
4. Replace the entire `index.ts` with `supabase/dashboard/blog-mcp.ts`. This file
   contains pinned npm imports and everything required in one file.
5. Deploy and keep **Verify JWT with legacy secret** off in the function's Details
   / Function configuration. The function intentionally has no OAuth or token check.
6. Supabase injects `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in its Edge runtime.
   No credentials need to be pasted into the function, Claude, or Cloudflare.
7. Visit the endpoint's `/health` URL; version should be `2.0.0`.
8. Keep the existing Claude connector and endpoint below. Refresh/reconnect if it
   still shows only eight tools; v2 exposes eleven tools. Authentication stays None.
9. Deploy the matching website build for cover images, inline images, captions,
   and cover-based Open Graph/Twitter/BlogPosting metadata. The new website loader
   also supports the v1 database while the migration is pending.

Endpoint: `https://gutvbukqlqutjwlbmfpr.supabase.co/functions/v1/blog-mcp`

Regenerate the dashboard file after source changes with
`node scripts/prepare-mcp-dashboard.mjs` from the repository root.

## Tools and workflow

- `get_site_context`: categories, HTML format, field limits, and rules.
- `list_posts`: filtered/paginated summaries of drafts or published posts.
- `get_post`: full saved article and current revision.
- `create_draft`: save sanitized HTML as a draft, compute reading time.
- `update_draft`: edit a draft using its current revision; cannot change status.
- `validate_draft`: publication readiness, HTML, fields, date, and slug checks.
- `publish_post`: publish a specific draft revision with `confirmed: true`.
- `unpublish_post`: return a published revision to drafts with `confirmed: true`.
- `upload_image`: base64 PNG/JPEG/WebP bytes, up to 4 MiB, plus alt text, source,
  credit and permission note. Raw standard base64, not a data URL. Use actual file
  bytes; never invent or truncate base64.
- `import_image_url`: imports from HTTPS `images.unsplash.com`,
  `upload.wikimedia.org` or `images.pexels.com`; requires a direct image URL and
  source/credit/permission metadata. Redirects are rejected. Other sources can
  be downloaded by a capable client and passed to `upload_image`.
- `list_images`: paginated registered uploads including credits and permission notes.

`create_draft` and `update_draft.changes` now accept `cover_image_url` and
`cover_image_alt`. Use an image URL returned by an upload/import tool. Empty strings
remove a cover. A cover needs alt text before publishing. Inline body HTML supports
`img`, `figure`, `figcaption`; images require meaningful alt text and an uploaded
bucket URL. External/hotlinked images are removed. Validation checks image records
and limits articles to twenty distinct images. Add visible credits/links in the
article or captions where the source's license requires attribution; the tool
records do not display credits automatically.

Uploads use SHA-256 content-addressed paths and never overwrite existing objects.
An exact image retry returns the original metadata. Upload and metadata insertion
are separate service operations: if the record fails, retry the same file to repair
it. This endpoint does not generate, resize, or independently verify image licenses.
File checks detect supported signatures; they are not a full image-decoding scan.
There is no image-delete tool. Draft images are publicly accessible; do not upload
private files. Unpublishing an article does not remove its public image files.

Claude instruction addition: “Use the v2 image tools for one relevant cover and
optional useful inline images. Select only files you have permission to reuse,
record their sources/credits/permissions, and include required visible attribution.
Write meaningful alt text. Show the proposed images for review before publishing.
If an image cannot be obtained, save the article as a draft and ask me to choose
whether to supply an image or continue without one. Do not fabricate image URLs
or base64 data. Override the earlier v1 restriction against images.”

Use a new UUID `request_id` for each intended write. For a network retry, reuse
the same UUID and identical arguments. Reusing an ID for different input fails.
Edits and status changes require `expected_revision`; reload after a conflict.
PostgreSQL performs the write, revision increment, audit entry, and retry record
in a single transaction. Audit rows are in `public.post_activity`; private retry
records are in `private.mcp_requests`. Public website clients cannot read these
records or invoke the write RPC.

Suggested first prompt: “Read the site context, create an article as a draft,
then validate it. Do not publish until I explicitly ask you to.” Publishing updates
the SSR site without rebuilding Cloudflare.

## Verification

In this directory: `npm ci`, `npm run check`, `npm test`.
Tests exercise the actual migrations and write RPC using embedded PostgreSQL,
through the MCP HTTP transport, with a minimal PostgREST read adapter. They check
sanitization, draft-only writes, revisions, idempotency, confirmation fields,
audit records, role permissions, request limits, and stateless tool discovery.
The hosted Supabase runtime and Claude connection must be checked after deployment.

CLI alternative (when configured with the owning Supabase account):
`supabase functions deploy blog-mcp --project-ref gutvbukqlqutjwlbmfpr --no-verify-jwt --use-api`.
