# Newsletter storage and contact delivery

Newsletter signups are stored in `public.newsletter_subscribers` in the existing Supabase project.
Apply `supabase/migrations/20261008163422_newsletter_subscribers.sql` before deploying the website change.
The website uses its existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; no Resend key or service-role key is needed to collect or view subscribers.

Enable **Settings → Accept newsletter subscriptions** to display the signup form. It validates email addresses, requires consent, and rejects the hidden spam-trap field. The database also enforces the pause setting and records signup and consent timestamps. Duplicate addresses are stored once; repeated submissions do not reset consent timestamps or reactivate unsubscribed contacts.

Visitors can submit consented signups but cannot read the subscriber list or update records. Designated admins can read subscribers, and database policies allow them to update subscription status. The admin list loads 100 rows at a time. Search, status filters, and CSV exports apply to loaded rows. The admin panel is read-only and does not send campaigns.

Existing Resend contacts are not automatically imported or deleted. To migrate them, export the dedicated AI Insights list from Resend and import it into Supabase separately, preserving unsubscribed status and consent evidence. Do not import unrelated account-wide contacts as newsletter subscribers.

Newsletter signup does not send a welcome email or synchronize contacts to Resend. Before sending a campaign, export only subscribed contacts to the chosen email provider and reconcile unsubscribes back into Supabase. Provide the email provider's unsubscribe link. This implementation uses single opt-in; signup consent does not imply address verification.

## Contact messages

The contact form continues to use Resend. Configure these server-only variables in Cloudflare Worker Settings → Variables and Secrets:

- `RESEND_API_KEY`: a Resend sending key.
- `CONTACT_FROM`: a sender on your verified domain.
- `CONTACT_TO`: the receiving email address.

For development use ignored `.env.local`; for Wrangler use ignored `.dev.vars`. Never commit secrets or use `VITE_` prefixes for them. Without email configuration the contact page offers a direct email link.

References: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Resend send email](https://resend.com/docs/api-reference/emails/send-email).
