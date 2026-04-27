# Reverse-Engineered Implementation Prompt

Use this prompt in a fresh Cursor chat when rebuilding the new app. It is intentionally explicit about the integrations that were painful in the current project.

```text
Build a Next.js App Router prototype called "Social Media Review Portal".

Context:
- This should be similar to the Family Command Centre project, but for an organisation's social media review workflow.
- Use Next.js on Vercel, Supabase Postgres/Auth/RLS/Storage, Twilio WhatsApp webhooks, Gemini, and Instagram/Meta publishing.
- Read the local blueprint files in `social-media-review-portal-blueprint/` before coding.
- This Next.js version may have API differences. Read relevant docs in `node_modules/next/dist/docs/` before writing Next.js code.

Core product:
1. Organisation members send photos and brief info to a WhatsApp number.
2. Twilio posts to `/api/webhooks/twilio/whatsapp`.
3. The app validates the Twilio signature.
4. The app downloads Twilio media immediately and uploads it to Supabase Storage.
5. The app creates a `submissions` row with photos, brief text, submitter WhatsApp number, and status.
6. Gemini creates a draft Instagram caption using the submitted brief and previous posts stored in a style-learning area.
7. Reviewers log into the portal, view pending submissions, edit the draft caption, approve, or reject with a reason.
8. Rejection sends a WhatsApp message back to the submitter with the rejection reason.
9. Approval creates an Instagram publish job.
10. Instagram publishing uses the Meta/Instagram container publishing API and records success/failure.

Use these implementation patterns:
- App Router server components for dashboard and detail pages.
- Server actions for reviewer actions where appropriate.
- Route handlers for Twilio, Gemini draft generation, Instagram OAuth, and publishing jobs.
- Supabase Auth for reviewers/admins.
- Supabase service role client only in server-only code paths.
- `zod` for request and AI response validation.

Twilio requirements:
- Route: `POST /api/webhooks/twilio/whatsapp`.
- Read raw body with `await request.text()`.
- Parse with `URLSearchParams`.
- Validate with:
  `twilio.validateRequest(authToken, signature, validationUrl, params)`.
- Do not use `validateRequestWithBody` unless the URL includes `bodySHA256`.
- Use `TWILIO_WEBHOOK_PUBLIC_URL` as the validation URL when set. It must exactly match the URL configured in Twilio.
- Return empty TwiML on success:
  `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`.
- Download `MediaUrlN` using HTTP Basic auth:
  username = `TWILIO_ACCOUNT_SID`
  password = `TWILIO_AUTH_TOKEN`
- Upload bytes to Supabase Storage bucket `organisation-media`.
- Store public URLs and Storage paths.
- Accept photo-only messages; use a placeholder brief if Body is empty.
- Be permissive for image media types because Twilio may send empty type or `application/octet-stream`.

Gemini requirements:
- Store previous post examples in `style_examples`.
- Add admin "Learning Area" page to paste/edit/delete examples.
- Draft route fetches organisation settings and recent style examples.
- Prompt Gemini to return JSON only.
- Use `generationConfig.responseMimeType = "application/json"`.
- Validate JSON with zod before saving.
- Do not invent facts such as scores, player names, dates, locations, or sponsors.
- Store `draft_caption`, `ai_model`, and `ai_error`.

Review requirements:
- Dashboard filters by submission status.
- Detail page shows photos, brief, submitter, draft, final caption, events, and publish state.
- Approve action saves final caption and creates a publish job.
- Reject action requires a comment, sets status `rejected`, saves reason, records event, and sends WhatsApp reply to original submitter.

Instagram requirements:
- Start with single-image and carousel photo publishing.
- Store organisation Instagram connection in `instagram_connections`.
- Use Meta OAuth for production design, but allow env-backed prototype values if needed.
- Create media container(s), create carousel parent if needed, publish via `media_publish`, then store media ID/permalink.
- Process publish work through `publish_jobs`, not directly in the page render.
- Keep the Instagram API wrapper isolated in `lib/instagram.ts`.

Database:
- Use the schema in `social-media-review-portal-blueprint/02-supabase-schema.sql`.
- Keep all organisation-owned records tenant-scoped by `organisation_id`.
- Enable RLS and use helper functions `is_org_member` and `is_org_admin`.

Environment:
- Use `.env.example` with all required keys.
- Never commit `.env.local`.
- Vercel env vars must include Supabase, Gemini, Twilio, and Meta settings.

Deliverables:
- Working portal UI.
- SQL migration(s).
- `.env.example`.
- Twilio webhook route.
- Gemini drafting route.
- Review server actions.
- Instagram publish job scaffold.
- README with setup, Vercel deployment, Twilio configuration, Supabase setup, and testing steps.

Build in phases:
1. Schema, auth, dashboard, detail pages.
2. Twilio intake and Storage.
3. Gemini style examples and draft generation.
4. Approve/reject workflow and WhatsApp rejection replies.
5. Instagram publishing.
6. SaaS/mobile-readiness cleanup.
```

