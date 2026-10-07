# Personalized reading, quality analytics and tag management

## Deploy in this order

1. In the AI Insights Supabase project (`gutvbukqlqutjwlbmfpr`), run the complete file
   `supabase/migrations/20261007154319_personalized_reading_quality_tags.sql` once in SQL Editor.
   It follows `20261007115755_reader_discovery.sql`, which you already applied.
2. Open Edge Functions → `blog-mcp` → Code. Replace the complete `index.ts` with
   `supabase/dashboard/blog-mcp.ts`, then deploy the function. Existing secrets stay in place.
3. Deploy the website through the GitHub pipeline after the database update is complete.

The migration preserves existing articles and analytics. Quality measurements start with
the new website; historical views are not counted as measured reads.

## Reader experience

On the homepage, readers can select up to 12 topic interests and 12 audience interests.
Their choices are saved in their browser and can be edited or reset. Matching articles
rank by shared topics (3 points) and audiences (2 points), then views and publication date.
Only published articles whose publication time has arrived are eligible.

Articles offer “Yes, helpful” and “Not yet” feedback. Readers can change their response;
only their latest response for that article, session and UTC day counts.

## Admin

**Readers** shows quality measurements for 7, 30 or 90 days alongside the existing traffic report:

- Completion: reaching at least 90% of the article body after 30 seconds with the tab visible.
  This is an estimate, not proof that the article was understood.
- Average depth: the furthest article-body scroll depth reached on each measured read.
- Helpfulness: helpful responses divided by all responses; readers who do not vote are excluded.
- Recommendation click rate: unique clicks divided by unique impressions by session and UTC day.
  An impression requires at least half the card to be visible; a click also counts as an impression.

**Tags** provides one vocabulary for topic and audience tags. Create tags, inspect their usage,
rename a tag to a new name, merge into an existing name, or remove unused tags. Renaming and
merging updates affected articles and their revisions. Old names remain aliases, preserving
older filtered links, preferences and publishing inputs. Tag changes have an admin-only audit.
Draft-only tags are hidden from public vocabulary suggestions. The article editor suggests
existing tags, and the MCP publishing context now supplies canonical names and aliases.

## Measurement and verification

Tracking excludes signed-in readers, recognized crawlers, Do Not Track and Global Privacy
Control. Storage restrictions can also prevent tracking. Preferences remain local; their
selected names are sent transiently to request recommendations. Private measurement rows
are not publicly readable and are retained for at most 90 days as analytics activity prunes them.

Verified with application and MCP type checks, ESLint, production build, Worker smoke checks,
and 29 isolated database/MCP tests. No verification writes to the production database.
