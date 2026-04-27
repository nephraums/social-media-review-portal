# Code Structure and Key Snippets

This is the recommended behind-the-scenes structure for the rebuild. It intentionally mirrors the working integrations in the current project.

## Suggested File Tree

```text
app/
  (main)/
    page.tsx
    submissions/[id]/page.tsx
    settings/style/page.tsx
    settings/instagram/page.tsx
  actions/
    submissions.ts
    style-examples.ts
  api/
    auth/instagram/start/route.ts
    auth/instagram/callback/route.ts
    cron/publish-jobs/route.ts
    submissions/[id]/draft/route.ts
    webhooks/twilio/whatsapp/route.ts
lib/
  env.ts
  gemini.ts
  instagram.ts
  map-submission.ts
  supabase/admin.ts
  supabase/server.ts
  twilio-media.ts
  twilio-messages.ts
  types.ts
supabase/
  migrations/
    001_social_media_review_portal.sql
```

## Environment Helper

```ts
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_DEFAULT_ORGANISATION_ID: z.string().uuid(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
});

export function getPublicEnv() {
  return envSchema
    .pick({
      NEXT_PUBLIC_SITE_URL: true,
      NEXT_PUBLIC_SUPABASE_URL: true,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: true,
      NEXT_PUBLIC_DEFAULT_ORGANISATION_ID: true,
    })
    .parse(process.env);
}

export function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  return key && key.length > 0 ? key : null;
}
```

## Supabase Service Role Client

```ts
import { createClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key);
}
```

## Twilio Media Helper

```ts
const BUCKET = "organisation-media";

export async function uploadTwilioMediaToStorage(opts: {
  supabase: SupabaseClient;
  accountSid: string;
  authToken: string;
  mediaUrl: string;
  declaredContentType: string;
  pathPrefix: string;
}) {
  const res = await fetch(opts.mediaUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString("base64")}`,
    },
  });

  if (!res.ok) {
    console.error("[whatsapp media] fetch failed", res.status, opts.mediaUrl);
    return null;
  }

  const fetchedType = res.headers.get("content-type") ?? "application/octet-stream";
  const ext = extensionFromTypes(opts.declaredContentType, fetchedType);
  const storagePath = `${opts.pathPrefix}.${ext}`;
  const buf = Buffer.from(await res.arrayBuffer());

  const { error } = await opts.supabase.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: fetchedType.split(";")[0]?.trim() ?? "application/octet-stream",
    upsert: false,
  });

  if (error) {
    console.error("[whatsapp media] upload failed", error.message);
    return null;
  }

  const { data } = opts.supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

function extensionFromTypes(declared: string, fetched: string) {
  const t = `${declared} ${fetched}`.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("heic") || t.includes("heif")) return "heic";
  return "jpg";
}
```

## Inbound Twilio Route Shape

```ts
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json({ error: "TWILIO_AUTH_TOKEN is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries());
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const validationUrl = process.env.TWILIO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, "")
    ?? new URL(request.url).toString().replace(/\/$/, "");

  const ok = twilio.validateRequest(authToken, signature, validationUrl, params);
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const from = params.From ?? "";
  const bodyText = (params.Body ?? "").trim();
  const numMedia = Math.min(10, Math.max(0, Number.parseInt(params.NumMedia ?? "0", 10) || 0));

  if (!from.startsWith("whatsapp:")) return emptyTwiML();
  if (!bodyText && numMedia === 0) return emptyTwiML();

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  if (numMedia > 0 && !accountSid) {
    return NextResponse.json({ error: "TWILIO_ACCOUNT_SID is not configured." }, { status: 503 });
  }

  const supabase = createServiceRoleClient();
  const organisationId = process.env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID!;
  const submissionId = crypto.randomUUID();
  const mediaUrls: string[] = [];
  const mediaPaths: string[] = [];

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params[`MediaUrl${i}`];
    const declaredType = (params[`MediaContentType${i}`] ?? "").trim();
    if (!mediaUrl || shouldSkipMediaType(declaredType)) continue;

    const uploaded = await uploadTwilioMediaToStorage({
      supabase,
      accountSid: accountSid!,
      authToken,
      mediaUrl,
      declaredContentType: declaredType,
      pathPrefix: `submissions/${organisationId}/${submissionId}/${i}`,
    });

    if (uploaded) {
      mediaUrls.push(uploaded.publicUrl);
      mediaPaths.push(uploaded.storagePath);
    }
  }

  const brief = bodyText || "(Photo submitted via WhatsApp)";

  await supabase.from("submissions").insert({
    id: submissionId,
    organisation_id: organisationId,
    whatsapp_from: from,
    brief,
    status: "received",
    media_urls: mediaUrls.length > 0 ? mediaUrls : null,
    media_paths: mediaPaths.length > 0 ? mediaPaths : null,
  });

  return emptyTwiML();
}
```

## Reject Action Shape

```ts
export async function rejectSubmission(id: string, reason: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: submission, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !submission) return { error: "Submission not found." };

  await supabase
    .from("submissions")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (submission.whatsapp_from) {
    await sendWhatsAppMessage({
      to: submission.whatsapp_from,
      body: `Thanks for your submission. It was not approved this time.\n\nReason: ${reason}`,
    });
  }

  revalidatePath("/");
  revalidatePath(`/submissions/${id}`);
}
```

## Approve Action Shape

```ts
export async function approveSubmission(id: string, finalCaption: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: submission, error } = await supabase
    .from("submissions")
    .update({
      status: "approved",
      final_caption: finalCaption,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, organisation_id")
    .single();

  if (error || !submission) return { error: error?.message ?? "Submission not found." };

  await supabase.from("publish_jobs").insert({
    organisation_id: submission.organisation_id,
    submission_id: submission.id,
    requested_by: user.id,
    status: "queued",
    platform: "instagram",
  });

  revalidatePath("/");
  revalidatePath(`/submissions/${id}`);
}
```

