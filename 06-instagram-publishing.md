# Instagram Publishing

Instagram is the new integration for this product. Build it after WhatsApp intake, Storage, Gemini drafting, and review states are working.

## Requirements

Instagram publishing through Meta requires:

- Instagram Professional account, Business or Creator.
- Instagram account connected to a Facebook Page.
- Meta app.
- OAuth connection for the organisation.
- Required permissions, depending on Meta's current API mode:
  - `instagram_business_basic`
  - `instagram_business_content_publish`
  - `pages_show_list`
- App Review before production use outside test users.
- Publicly reachable media URLs. Instagram downloads the media from your URL.

For the prototype, use one club-owned Instagram account and a test Meta app user first.

## Data Model

Use:

- `instagram_connections`: stores connected Instagram account details and token.
- `publish_jobs`: stores queued/running/succeeded/failed publishing work.
- `submissions`: stores final publish result fields:
  - `instagram_media_id`
  - `instagram_permalink`
  - `status`

Important: encrypt tokens before production. For a prototype, storing in Supabase is acceptable only if access is tightly limited and never exposed to the browser.

## Publishing Flow

Instagram publishing is container-based:

1. Create a media container for each image URL.
2. If one image, publish that container.
3. If multiple images, create child containers, create a carousel parent container, then publish the parent.
4. Poll container status if needed.
5. Save Instagram media ID and permalink.

## Single Image Pseudocode

```ts
const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
const base = `https://graph.facebook.com/${graphVersion}`;

const createRes = await fetch(
  `${base}/${connection.instagram_user_id}/media`,
  {
    method: "POST",
    body: new URLSearchParams({
      image_url: submission.media_urls[0],
      caption: finalCaption,
      access_token: connection.access_token,
    }),
  },
);

const { id: creationId } = await createRes.json();

const publishRes = await fetch(
  `${base}/${connection.instagram_user_id}/media_publish`,
  {
    method: "POST",
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: connection.access_token,
    }),
  },
);

const { id: mediaId } = await publishRes.json();
```

## Carousel Pseudocode

```ts
const childIds = [];

for (const imageUrl of submission.media_urls) {
  const childRes = await fetch(`${base}/${igUserId}/media`, {
    method: "POST",
    body: new URLSearchParams({
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token,
    }),
  });
  const child = await childRes.json();
  childIds.push(child.id);
}

const parentRes = await fetch(`${base}/${igUserId}/media`, {
  method: "POST",
  body: new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: finalCaption,
    access_token,
  }),
});

const parent = await parentRes.json();

const publishRes = await fetch(`${base}/${igUserId}/media_publish`, {
  method: "POST",
  body: new URLSearchParams({
    creation_id: parent.id,
    access_token,
  }),
});
```

## Recommended Server Routes

- `GET /api/auth/instagram/start`
  - Redirects admin to Meta OAuth.
- `GET /api/auth/instagram/callback`
  - Exchanges code for token, finds IG user ID, stores `instagram_connections`.
- `POST /api/submissions/[id]/approve`
  - Saves `final_caption`, sets status `approved`, inserts `publish_jobs` row if auto-publish is enabled.
- `POST /api/publish-jobs/[id]/run`
  - Runs a single publish job.
- `POST /api/cron/publish-jobs`
  - Vercel Cron route that processes queued jobs.

## Job Processing Rules

- Use service role on the server.
- Lock or mark job `running` before publishing to avoid duplicate posts.
- Increment `attempt_count`.
- Save full non-secret API error messages to `last_error`.
- Set submission status:
  - `publishing` when job starts.
  - `published` when media publish succeeds.
  - `failed` if the job fails after max attempts.

## Media Format Notes

- Start with JPEG/PNG images only.
- WhatsApp HEIC photos may display in Storage but may not be accepted by Instagram. Convert HEIC to JPEG before Instagram publishing in a later production pass.
- Instagram must be able to access the image URL without auth. Public Supabase Storage URLs work for the prototype.
- If you later make media private, publish through short-lived signed URLs that remain valid while Instagram fetches them.

## Review UX

In the portal detail page:

- Show photos.
- Show submitted brief.
- Show Gemini draft.
- Provide editable `final_caption`.
- Buttons:
  - Regenerate draft
  - Save edits
  - Reject
  - Approve
  - Publish now (if approved but not published)

## Production Caveats

- Meta app review can take time and requires a working screencast.
- Test users can publish before public app approval.
- Long-lived tokens expire and need refresh handling.
- Publishing limits and permissions can change; keep this layer isolated in `lib/instagram.ts`.
- Consider using a queue provider later if Vercel function timeouts become an issue.

