# Reader discovery and analytics

The post editor and Blog MCP support `tags` (topics) and `audience_tags` (intended readers).
Each field accepts up to 12 unique lowercase tags, each up to 40 characters. Admin inputs
use commas. Initial tags for the 11 existing published articles are included in the migration;
they do not overwrite articles already tagged. Review these editorial choices in the editor.

Readers can click tags on articles, filter `/blog` by topic or audience, and choose Most read.
Related reading ranks shared topics (3 points each), shared audiences (2 each), and category
(1), then lifetime recorded views, publication date, and slug. Category supplies a fallback
for untagged articles. Only published, due articles are returned. No private reader profiles
are needed for recommendations.

## Deployment order

1. Apply `supabase/migrations/20261007115755_reader_discovery.sql` to AI Insights project
   `gutvbukqlqutjwlbmfpr` after the existing migrations. It adds columns, aggregate totals,
   a public catalog view with invoker security, a bounded read-recording RPC, and an admin-only
   aggregate report. It updates the existing MCP write transaction without changing revision
   or retry protections. The previous website and MCP remain compatible with this migration.
2. Deploy the updated website using the existing Cloudflare workflow (`npm run build`,
   then `npm run deploy`), or push reviewed changes through the connected repository workflow.
3. Regenerate the dashboard bundle with `node scripts/prepare-mcp-dashboard.mjs` and deploy
   it to the existing `blog-mcp` function with its existing authentication configuration.
   The website build does not deploy the Edge Function.
4. Read an article while signed out. Reopening it in the same tab/day should not add another
   view. After 30 visible seconds it should gain one engaged read. Open Admin → Readers to
   inspect the report. Verify tag filters and recommended reading after tagging posts.

## What is measured

One view per article, tab session and UTC date. A random UUID lives in sessionStorage;
there is no persistent analytics cookie or fingerprint. Analytics store the post ID, UUID,
date, broad source group, device group and a 30-visible-second engagement flag. No IP or full
referrer URL is stored in the readership tables. Privacy signals, known crawler user agents
and signed-in sessions are excluded by the browser; the database also excludes authenticated
reads. Visitors without JavaScript or accessible sessionStorage are not counted.

Admin reports cover 7, 30 or 90 days, with sessions, views, engagement, popular articles,
topics, intended audiences, sources, devices and daily totals. Topic/audience reports use
the current article tags, and multi-tag articles count in each matching tag. Sessions are
not distinct people; audiences are inferred content interests, not measured occupations,
age, location or demographics. Direct includes unknown referrals. Source classification
comes from the browser's document referrer. Counts are approximate and public ingestion
can be manipulated by clients creating new session IDs; do not use them for billing.

Raw session rows older than 90 days are deleted on the next valid recorded read or admin
report refresh. There is no background retention job. All-time article view totals remain
without session identifiers. Public roles can read only aggregate totals for published posts;
they cannot write those totals, inspect sessions, or access the admin report. Views are stored
separately from posts so recording a read does not create article revisions or SEO last-modified
changes. Existing traffic cannot be reconstructed.

## Google and Search Console

Topics and intended audiences are visible in server-rendered pages and in BlogPosting
JSON-LD (`keywords`, `about`, `articleSection`, `audience`). They explain the content, but do
not instruct Google to target readers or guarantee ranking. Google ignores keyword meta tags:
https://developers.google.com/search/docs/crawling-indexing/special-tags

The homepage advertises a branded 96×96 PNG and an ICO fallback containing the same image,
and keeps the existing SVG asset for reuse. Live checks on October 7, 2026 found HTTP 200 for the homepage,
both previous icons, robots.txt and sitemap.xml, with the expected canonical homepage URL.
This establishes accessibility, not Google's indexing status or favicon selection.

For an empty Performance report, select a domain property covering `sitenova.dev` or the exact
`https://ai-insights.sitenova.dev/` URL prefix; clear query/page filters and inspect the date
range. A newly added site can take up to a week to generate data; collected data normally has
a 2–3 day reporting delay. Rare queries may be omitted. Check URL Inspection for the homepage
and an article, their indexing status, Google's canonical, and last crawl. Submit the sitemap.
Search Console account data is not connected to this dashboard.
https://support.google.com/webmasters/answer/96568

After deploying, request homepage indexing to help Google discover the favicon. Google may
take days to weeks to recrawl/process it, and showing it is not guaranteed.
https://developers.google.com/search/docs/appearance/favicon-in-search

Verification: application and MCP type checks, production build, production Worker smoke
checks for SSR tags/JSON-LD, filters/popularity and favicon assets, and MCP/PGlite tests for
tag writes, view deduplication, engagement, private access and recommendation ranking.
