# Activate contact and newsletter forms

The site uses Resend's HTTPS API. No Supabase migration is required.
Without the configuration below, forms display an unavailable message and contact offers a direct email link. They never report a simulated success.

1. Verify a sending domain in Resend and create an API key with access to send emails and manage contacts. A sending-only key cannot create newsletter contacts.
2. In Cloudflare Worker Settings → Variables and Secrets, set:
   - `RESEND_API_KEY`: secret Resend key.
   - `CONTACT_FROM`: a verified sender, e.g. `AI Insights <hello@your-verified-domain>`.
   - `CONTACT_TO`: `kavishganatra5@gmail.com`.
   - `RESEND_SEGMENT_ID`: optional dedicated newsletter segment ID. Without one, contacts are added to the account-wide list; a dedicated segment is recommended for accounts serving several sites.
3. For development, set the same variables in ignored `.env.local`; for Wrangler use ignored `.dev.vars`. Do not put credentials in git, `wrangler.jsonc` or variables beginning with `VITE_`.
4. Deploy the website using its existing Cloudflare workflow. Send a contact message from an address you control, confirm inbox arrival and Reply-To, and subscribe your own address. Test an unavailable provider as well.
5. Send campaigns through Resend Broadcasts to the AI Insights segment and include the provider's unsubscribe link. The website captures subscriptions; it does not automatically send weekly campaigns. Explicit consent is required and the email address must belong to the subscriber. This implementation uses single opt-in; use a confirmed opt-in workflow before campaigns if that is your publishing policy.

Forms retain server-side validation, explicit consent and a hidden spam-trap field. Turnstile is deferred at the owner's request until traffic increases. Apply an appropriate Cloudflare rate limiting rule or add Turnstile later if spam becomes an issue.
Provider error responses and visitor information are not written to application logs. A provider success means accepted for processing, not guaranteed inbox delivery. Contact retries reuse a request ID to avoid duplicate delivery when Resend's response is interrupted.

Optional image optimization: set `SUPABASE_IMAGE_TRANSFORMS=true` only if Supabase image transformations are available on the project. Otherwise the site serves original images with explicit aspect ratios, eager loading for the feature, and lazy loading elsewhere.

References: [Resend send email](https://resend.com/docs/api-reference/emails/send-email), [Resend create contact](https://resend.com/docs/api-reference/contacts/create-contact).

## Admin subscriber list

Admin → Subscribers reads contacts directly from Resend after checking the signed-in user's designated admin access. The website server needs `RESEND_API_KEY` with contact read access. A sending-only key will show a permissions error. Credentials and provider error bodies never reach the browser.

When `RESEND_SEGMENT_ID` is configured, the view lists that segment. Without a segment, an explicit **View all Resend contacts** action opens the account-wide list, labelled accordingly; contacts from other websites cannot be attributed to this newsletter. Configuring a segment later does not move earlier account-wide signups into it automatically. Use Resend to place the appropriate existing contacts in the segment.

The list loads 100 contacts at a time, with **Load more from Resend** for further pages. Search, status filters and CSV export cover the contacts loaded in the view. Subscribed and unsubscribed statuses come from Resend; contact creation time may precede newsletter signup. This admin view does not send campaigns or change contacts.

References: [List segment contacts](https://resend.com/docs/api-reference/segments/list-segment-contacts), [List contacts](https://resend.com/docs/api-reference/contacts/list-contacts).
