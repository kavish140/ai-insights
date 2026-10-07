# Activate expanded admin settings

Run `supabase/migrations/20261007082552_expanded_site_settings.sql` once in the AI Insights Supabase project (`gutvbukqlqutjwlbmfpr`). It follows the Basic, Good and Top admin migrations. The transaction adds settings columns and an admin-only change history; existing settings and articles are preserved. This migration belongs to AI Insights, not the separate SiteNova database.

Refresh Admin → Settings after the SQL succeeds. The controls remain disabled until the new columns are available. Deploy the website code through the existing GitHub/Cloudflare workflow to make the new UI available online. No MCP function deployment is required for this change.

Settings now controls:

- Site name, tagline, description, logo initials, header button label and footer copyright note.
- Homepage heading and SEO title/description, latest article count, articles per listing page, guided reading path and promotional placements.
- Newsletter visibility, signup availability, heading and description; contact form availability and public contact email.
- Default author for new drafts, and the default category for emergency drafts created in admin. MCP uses the default author when one is omitted; its category is still chosen explicitly.
- LinkedIn, YouTube and X footer links. Blank links are hidden; links must use HTTPS without embedded credentials.

Paused newsletter and contact forms reject server submissions as well as changing their public appearance. These settings do not send emails, campaigns or change existing subscriber statuses. Email connections show configuration presence only; API keys, contact delivery sender/recipient and newsletter segment ID remain server configuration, described in `docs/email-setup.md`.

Saves check the current revision to prevent overwriting another admin tab's changes. Admins can view the last ten saves and load previous values or defaults as unsaved edits, then review and save. The database records who saved each change and prevents browser clients from modifying that history. The public site can read the non-secret site settings; settings history is private to designated admins.

Local verification: `npm run check`, `node scripts/test-public-site.mjs`, `node scripts/test-subscribers.mjs`, `npm test` in `supabase/functions/blog-mcp`, `npm run build`, and `node scripts/smoke-ssr.mjs`. The migration tests use an isolated PostgreSQL database and the Worker smoke test uses a local API fixture; neither writes to production or creates real email contacts.
