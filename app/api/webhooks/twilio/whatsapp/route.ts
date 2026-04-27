import { NextResponse } from "next/server";
import twilio from "twilio";
import { draftSubmissionCaption } from "@/lib/drafting";
import { getPublicEnv } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { shouldSkipMediaType, uploadTwilioMediaToStorage } from "@/lib/twilio-media";

export const runtime = "nodejs";

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return NextResponse.json({ error: "TWILIO_AUTH_TOKEN is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody).entries());
  const signature = request.headers.get("x-twilio-signature") ?? "";
  const validationUrl =
    process.env.TWILIO_WEBHOOK_PUBLIC_URL?.replace(/\/$/, "") ??
    new URL(request.url).toString().replace(/\/$/, "");

  const skipSignature =
    process.env.NODE_ENV !== "production" && process.env.TWILIO_SKIP_SIGNATURE_VERIFY === "true";

  if (!skipSignature && !twilio.validateRequest(authToken, signature, validationUrl, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const from = params.From ?? "";
  const bodyText = (params.Body ?? "").trim();
  const numMedia = Math.min(10, Math.max(0, Number.parseInt(params.NumMedia ?? "0", 10) || 0));

  if (!from.startsWith("whatsapp:")) return emptyTwiML();
  if (!bodyText && numMedia === 0) return emptyTwiML();

  const allowlist = parseAllowlist(process.env.TWILIO_WHATSAPP_ALLOWLIST);
  if (allowlist.length > 0 && !allowlist.includes(from)) {
    return emptyTwiML();
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  if (numMedia > 0 && !accountSid) {
    return NextResponse.json({ error: "TWILIO_ACCOUNT_SID is not configured." }, { status: 503 });
  }

  const env = getPublicEnv();
  const supabase = createServiceRoleClient();
  const organisationId = env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID;
  const submissionId = crypto.randomUUID();

  const { data: submitter, error: submitterError } = await supabase
    .from("submitters")
    .upsert(
      {
        organisation_id: organisationId,
        whatsapp_from: from
      },
      { onConflict: "organisation_id,whatsapp_from" }
    )
    .select("id")
    .single();

  if (submitterError) {
    console.error("[twilio webhook] submitter upsert failed", submitterError.message);
  }

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
      pathPrefix: `submissions/${organisationId}/${submissionId}/${i}`
    });

    if (uploaded) {
      mediaUrls.push(uploaded.publicUrl);
      mediaPaths.push(uploaded.storagePath);
    }
  }

  const brief = bodyText || "(Photo submitted via WhatsApp)";
  const { error: insertError } = await supabase.from("submissions").insert({
    id: submissionId,
    organisation_id: organisationId,
    submitter_id: submitter?.id ?? null,
    whatsapp_from: from,
    brief,
    status: "received",
    media_urls: mediaUrls.length > 0 ? mediaUrls : null,
    media_paths: mediaPaths.length > 0 ? mediaPaths : null
  });

  if (insertError) {
    console.error("[twilio webhook] submission insert failed", insertError.message);
    return NextResponse.json({ error: "Submission insert failed." }, { status: 500 });
  }

  await supabase.from("submission_events").insert({
    organisation_id: organisationId,
    submission_id: submissionId,
    actor_label: "twilio",
    event_type: "received",
    details: {
      from,
      media_count: mediaUrls.length,
      body_present: bodyText.length > 0
    }
  });

  const { data: settings } = await supabase
    .from("organisation_ai_settings")
    .select("auto_draft")
    .eq("organisation_id", organisationId)
    .maybeSingle();

  if (settings?.auto_draft !== false && process.env.GEMINI_API_KEY) {
    try {
      await draftSubmissionCaption({ supabase, submissionId });
    } catch (error) {
      console.error("[twilio webhook] auto-draft failed", error);
    }
  } else {
    await supabase.from("submissions").update({ status: "pending_review" }).eq("id", submissionId);
  }

  return emptyTwiML();
}

function emptyTwiML() {
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: {
      "content-type": "text/xml"
    }
  });
}

function parseAllowlist(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
