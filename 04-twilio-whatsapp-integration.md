# Twilio WhatsApp Integration

This is the integration that caused the most friction in the Family Command Centre build. Reuse these patterns exactly.

## Inbound Route

Create:

`app/api/webhooks/twilio/whatsapp/route.ts`

The route must:

1. Use `runtime = "nodejs"` because media download, Twilio SDK, and Buffer usage are server-side concerns.
2. Read the raw request body with `await request.text()`.
3. Parse the form body with `URLSearchParams`.
4. Validate the signature using `twilio.validateRequest(authToken, signature, validationUrl, params)`.
5. Never use `validateRequestWithBody` for normal Twilio webhooks unless the URL includes `bodySHA256`.
6. Check `From` starts with `whatsapp:`.
7. Read:
   - `Body`
   - `NumMedia`
   - `MediaUrl0`, `MediaUrl1`, etc.
   - `MediaContentType0`, `MediaContentType1`, etc.
8. Generate a submission ID before upload so Storage paths are stable.
9. Download each media URL immediately with Basic auth.
10. Upload media to Supabase Storage.
11. Insert a `submissions` row with durable media URLs and paths.
12. Return empty TwiML so Twilio receives HTTP 200.

## Signature Validation Pattern

```ts
const rawBody = await request.text();
const params = Object.fromEntries(new URLSearchParams(rawBody).entries());
const signature = request.headers.get("x-twilio-signature") ?? "";

const publicUrl = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.trim();
const reqUrl = new URL(request.url);
const validationUrl =
  publicUrl && publicUrl.length > 0
    ? publicUrl.replace(/\/$/, "")
    : `${reqUrl.origin}${reqUrl.pathname}`;

const ok = twilio.validateRequest(
  process.env.TWILIO_AUTH_TOKEN!,
  signature,
  validationUrl,
  params,
);

if (!ok) {
  return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
}
```

## Media Download Pattern

Twilio media URLs are temporary and protected. Fetch them with:

- Username: `TWILIO_ACCOUNT_SID`
- Password: `TWILIO_AUTH_TOKEN`

```ts
const res = await fetch(mediaUrl, {
  headers: {
    Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
  },
});
```

Upload the bytes to Supabase Storage:

```ts
const buf = Buffer.from(await res.arrayBuffer());

await supabase.storage.from("organisation-media").upload(storagePath, buf, {
  contentType,
  upsert: false,
});
```

Store both:

- `media_paths`: internal Storage paths, useful for cleanup or signed URL generation.
- `media_urls`: public URLs for quick portal display and Instagram publishing.

## Content Type Handling

Do not require `MediaContentTypeN` to always start with `image/`.

WhatsApp/Twilio may send:

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/heic`
- empty string
- `application/octet-stream`

For this app, skip obvious non-images:

- `video/*`
- `audio/*`
- `application/pdf`
- `text/*`

Start with photos only. Add video later after the Instagram flow is stable.

## Photo-Only Messages

Members may send a photo with no caption. Treat that as a valid submission with a placeholder brief:

```ts
const brief = bodyText.length > 0 ? bodyText : "(Photo submitted via WhatsApp)";
```

The portal can show "No brief supplied" but the row should still be created.

## Outbound Rejection Message

When a reviewer rejects a submission, call Twilio from a server action or route:

```ts
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!,
);

await client.messages.create({
  from: process.env.TWILIO_WHATSAPP_FROM!,
  to: submission.whatsapp_from!,
  body:
    "Thanks for your submission. The social media team did not approve it this time.\n\n" +
    `Reason: ${reason}`,
});
```

Save an event:

```ts
await supabase.from("submission_events").insert({
  organisation_id: submission.organisation_id,
  submission_id: submission.id,
  actor_user_id: user.id,
  event_type: "rejected_whatsapp_sent",
  details: { reason },
});
```

## Twilio Troubleshooting

- **403 Invalid signature**: Check `TWILIO_WEBHOOK_PUBLIC_URL`, exact path, scheme, and trailing slash.
- **Webhook works locally but not Vercel**: Check Vercel env vars and Deployment Protection.
- **No photo in portal**: Check Vercel logs for `[whatsapp media] fetch failed` or `[whatsapp media] upload failed`.
- **Fetch failed 401/403**: `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` do not match the Twilio account that owns the WhatsApp sender.
- **No row inserted**: Verify `SUPABASE_SERVICE_ROLE_KEY` exists in Vercel and the schema was run.
- **Rows inserted but images broken**: Confirm `organisation-media` bucket exists and is public, or generate signed URLs instead.

