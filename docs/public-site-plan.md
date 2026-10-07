# Public site implementation plan

All four phases are implemented in the working tree. Email activation and publishing
remain deployment steps: the forms require provider credentials, and the public
website changes have not been deployed by this task.

## Phase 1 — Reliable contact

- Replace simulated submission with a validated server request to Resend.
- Add pending, success, unavailable and retry states, explicit consent and a hidden spam-trap field.
- Keep provider secrets on the server. Never claim delivery when configuration is missing.

## Phase 2 — Homepage and discovery

- Compact the hero and put an illustrated featured article before the house ad.
- Add a three-step beginner reading path and limit latest articles to six.
- Add URL-backed keyword search, category filtering, sorting and twelve-item server pagination.
- Fetch summaries for lists and only the requested body for article pages.

## Phase 3 — Reading and editorial trust

- Add heading anchors, a table of contents, section overview, visible update dates and topic-matched related articles.
- Provide a downloadable workflow checklist and an accessible workflow diagram.
- Explain editorial standards and corrections without inventing author qualifications.
- Add a privacy page explaining contact and subscription processing.

## Phase 4 — Returning readers and quality

- Add consent-based Resend newsletter registration with real provider feedback.
- Supply responsive image candidates when image transformation is enabled; retain original images by default.
- Add skip navigation, focus styles, reduced-motion handling and mobile metadata wrapping.
- Verify TypeScript, production build, SSR, server validation/provider failure behavior and desktop/mobile layouts.

## Activation requirements

Contact requires RESEND_API_KEY, CONTACT_FROM and CONTACT_TO. The requested recipient is kavishganatra5@gmail.com.
Newsletter requires RESEND_API_KEY. Newsletter campaigns are sent through Resend Broadcasts, with unsubscribe links; subscription capture does not schedule campaigns.
Turnstile is deferred at the owner's request until traffic increases. No widget or verification keys are required now.
Optional SUPABASE_IMAGE_TRANSFORMS=true requires image transformation support on the project's plan.
The author is Kavish Ganatra. The bio describes established work on SiteNova websites and the publishing workflow without claiming unverified qualifications. Existing named guest authors remain intact; the legacy “AI Insights” byline displays Kavish's name.

No live messages, subscriptions, database changes or deployment are necessary to verify the implementation locally.

## Verification

- TypeScript check and production build pass.
- ESLint passes for the public-site files changed in these phases.
- `node --experimental-strip-types scripts/test-public-site.mjs` verifies provider contracts, input validation, consent, spam prevention, idempotency and failure handling without sending messages.
- `node scripts/smoke-ssr.mjs` exercises the production Worker with a local database fixture, including metadata, sanitization, search, filters, pagination, article navigation, checklists, 404 and empty states.
- Desktop and 390px mobile layouts were inspected in the local production preview. Mobile navigation expands and closes on selection; a collapsible section list precedes the article body on small screens.
- A read-only query confirmed the live articles use the expected published status, categories, author and featured fields. No production data was changed.

Key takeaways use the author's explicit summary sections when present; other articles
show a section overview rather than an invented summary. Workflow downloads are
general launch checklists for Automation articles. Responsive transformed image
candidates remain opt-in because that Supabase capability requires a supported plan.
