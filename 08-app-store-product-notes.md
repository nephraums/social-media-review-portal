# App Store and SaaS Product Notes

The prototype should be web-first, but the backend should be shaped so a future iOS app can reuse it.

## Design Now for Mobile Later

- Keep business actions in route handlers or server actions that can later become JSON API endpoints.
- Keep tenant scoping explicit with `organisation_id`.
- Avoid putting core workflow logic only inside React components.
- Store media in Supabase Storage, not on the local filesystem.
- Store submitters separately from portal users.
- Keep a clear status machine for submissions and publish jobs.

## Future Mobile App Shape

The iOS app could use:

- Supabase Auth for reviewers/admins.
- JSON API endpoints for:
  - List submissions
  - Get submission detail
  - Update final caption
  - Approve
  - Reject
  - Regenerate Gemini draft
  - Upload photos directly
- Push notifications for new submissions and failed publish jobs.

Members may not need the app at first because WhatsApp is the lowest-friction intake channel.

## Subscription Model Preparation

Add later:

- `plans`
- `subscriptions`
- `organisation_usage`
- usage counters for:
  - submissions per month
  - Gemini draft generations
  - published posts
  - Storage usage
  - reviewer seats

Suggested tiers:

- Starter: one organisation, limited monthly submissions, one connected Instagram account.
- Club: more submissions, multiple reviewers, larger style library.
- Multi-club / Agency: multiple organisations, multiple channels, advanced approvals.

## Security and Compliance

- Service role key stays server-only.
- Twilio auth token stays server-only.
- Meta access token stays server-only and should be encrypted before production.
- Add audit events for review and publishing actions.
- Allow admins to delete media and submissions.
- Add data export and deletion workflows before a commercial launch.

## Product Boundary

For the prototype, keep it narrow:

- WhatsApp intake.
- Instagram photo publishing.
- Human approval before publishing.
- Gemini caption drafting from style examples.

Do not start with:

- TikTok, Facebook, LinkedIn integrations.
- Complex scheduling.
- Native mobile submitter app.
- Multi-language support.
- Advanced AI training.

Those can come later after the core review loop is proven.

