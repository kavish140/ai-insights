# SEO implementation and launch checks

Public pages render on the server with titles, descriptions, social previews,
canonical URLs and an English language declaration. Indexable pages permit large
image previews. Blog pagination has a canonical URL for each page; page one omits
the default query parameters. Topic listings have individual headings and
descriptions. Search, tag, audience, alternative sort orders and empty listings
use `noindex, follow`; these URLs remain crawlable so engines can see the directive.
Out-of-range pages return 404. Trailing slashes redirect permanently to the same
URL without the slash, preserving query parameters.

Website, publisher and editor schema use shared identifiers. Article schema links
to the actual editor profile when applicable and uses only an actual article cover
as its article image. The generic banner remains available for social previews.
Collection pages describe their visible article lists. JSON-LD escapes HTML script
delimiters. Admin and error responses carry an HTTP noindex directive.

`/sitemap.xml` includes static pages, populated topic listings and every published,
non-future article. Summary queries paginate through database row limits rather
than downloading article bodies. Article entries include stored modification dates
and cover images. More than 5,000 entries automatically produce a sitemap index
with child sitemaps under `/sitemaps/`. XML responses cache for five minutes.

## Verification

```sh
npm run check
bun scripts/test-seo.mjs
npm run build
node scripts/smoke-ssr.mjs
```

The production Worker smoke test verifies rendered metadata, JSON-LD, canonical
pagination, index controls, topic pages, redirects, error status codes and sitemap
completeness when the database limits each response to seven rows. It uses a local
fixture without changing production data.

## After deployment

1. Verify the domain in Google Search Console and Bing Webmaster Tools. Submit
   `https://ai-insights.sitenova.dev/sitemap.xml`. Domain verification requires the
   owner's account and DNS access; no verification tokens are invented here.
2. Inspect the homepage, an article, a topic listing and page two with Search
   Console URL Inspection. Confirm successful indexing and selected canonicals.
3. Run Google's Rich Results Test on an article with a cover. Confirm that the
   cover is crawlable; if it uses Supabase Storage, verify that storage hostname in
   Search Console for image diagnostics.
4. Measure mobile Core Web Vitals with PageSpeed Insights and Search Console using
   the deployed site. Review LCP, INP and CLS using field data when available.
5. Review search queries, impressions, clicks and indexing exclusions monthly.
   Use this evidence to prioritize useful new content and improve existing pages.

## Editorial growth

Develop the existing Automation, Awareness and Strategy topic groups around real
reader questions. Link related guides in the article body using descriptive anchor
text. Include original examples, sources, tested tool versions, limitations and
accurate author details. Keep titles specific and descriptions useful; avoid
keyword stuffing and duplicate articles. Add relevant covers with descriptive alt
text. Update publication/modification dates when the content actually changes.

Suggested areas fit the site's existing remit: beginner AI workflows, choosing an
agent versus a workflow, human review checkpoints, privacy when sharing data with
AI tools, and measuring time saved by automation. Validate demand with Search
Console before making a large publishing investment. No rankings or rich-result
appearance are guaranteed by metadata or schema.

References: [Google pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading),
[Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article),
[sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
