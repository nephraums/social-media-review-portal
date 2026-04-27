# Rebuild Plan

## Product Goal

Build a Social Media Review Portal for organisations. Members submit photos and brief context to a WhatsApp number. The portal stores the submission, uses Gemini to draft a social media caption in the organisation's established voice, and lets social media owners approve or reject the post. Approved posts are published to Instagram. Rejected submissions trigger a WhatsApp reply with the reviewer comment.

## Core User Roles

- **Member**: Sends photos plus short context by WhatsApp. Does not need portal access.
- **Reviewer / Social media owner**: Logs into the portal, reviews drafts, edits copy, approves, rejects, and sees publishing state.
- **Organisation admin**: Manages style examples, Instagram connection, reviewer access, WhatsApp allowlist policy, and billing later.
- **Platform owner**: Operates the SaaS, monitors webhook failures, manages tenants, and supports subscriptions.

## Workflow

1. A member sends one or more photos to the organisation's WhatsApp number with brief info.
2. Twilio sends a form-encoded POST to `/api/webhooks/twilio/whatsapp`.
3. The webhook validates the Twilio signature using the exact public URL and parsed form params.
4. The webhook downloads Twilio media immediately using `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
5. Media is uploaded to Supabase Storage under a durable path such as `submissions/{organisation_id}/{submission_id}/{index}.jpg`.
6. A `submissions` row is inserted with status `drafting` or `pending_review`.
7. Gemini reads the brief info plus saved style examples and writes draft post text as validated JSON.
8. Reviewers open the portal, inspect photos, edit the draft, and either approve or reject.
9. Rejecting saves a rejection reason and sends a WhatsApp message back to the original sender.
10. Approving creates an Instagram publish job.
11. A server route or background job creates Instagram media containers, waits until ready, publishes, and records the Instagram post ID/permalink.

## Suggested Build Phases

### Phase 1 - Intake Portal

- Scaffold Next.js App Router app with Supabase Auth.
- Create Supabase schema from `02-supabase-schema.sql`.
- Build dashboard list with filters: `pending_review`, `approved`, `rejected`, `published`, `failed`.
- Build submission detail page that shows photos, member WhatsApp number, brief info, draft caption, and audit events.
- Implement Twilio inbound webhook and Storage upload using the working Family Command Centre pattern.

### Phase 2 - Gemini Drafting and Style Library

- Add a "Learning Area" page for admins to paste previous posts.
- Store each previous post as a `style_examples` row.
- Add a Gemini route that fetches relevant style examples for the organisation and returns strict JSON.
- Run drafting automatically after WhatsApp intake and allow reviewers to regenerate.

### Phase 3 - Review Actions

- Add approve, reject, edit caption, and regenerate buttons.
- On reject, require a comment and send a Twilio WhatsApp reply to the submitter.
- Track all state changes in `submission_events`.

### Phase 4 - Instagram Publishing

- Add organisation Instagram connection settings.
- Implement Meta OAuth and token storage.
- Implement single-image and carousel publishing through Instagram content publishing endpoints.
- Record publish job state and API responses.
- Start with manual "Publish approved post" button, then add automatic publish on approval once reliable.

### Phase 5 - SaaS and Mobile-Ready Product

- Make all data tenant-scoped by `organisation_id`.
- Add roles, invitations, billing tables, subscription state, and usage limits.
- Keep business logic behind server APIs so a later iOS app can call the same backend.
- Add mobile-friendly JSON endpoints separate from web UI components.

## Recommended Status Model

- `received`: webhook inserted the submission.
- `drafting`: Gemini generation is running.
- `pending_review`: draft is ready for human review.
- `approved`: reviewer approved the post.
- `rejected`: reviewer rejected and supplied a reason.
- `publishing`: Instagram publish job is running.
- `published`: Instagram confirmed publish.
- `failed`: drafting or publishing failed and needs attention.

## Architecture Notes

- Treat this as a multi-tenant app from day one. Even if the prototype has one club, model `organisations` explicitly.
- Keep WhatsApp senders separate from portal users. A member can submit without an account.
- Do not store Twilio media URLs as the source of truth. Store Supabase Storage paths and derived public URLs.
- Use service role only in route handlers that must bypass RLS, such as Twilio webhooks and publishing jobs.
- Prefer job rows over long blocking requests for Instagram publishing because Meta container processing can take time.
- Make all AI output editable. Gemini drafts should accelerate reviewers, not bypass judgement.

