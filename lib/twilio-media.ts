import type { SupabaseClient } from "@supabase/supabase-js";

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
      Authorization: `Basic ${Buffer.from(`${opts.accountSid}:${opts.authToken}`).toString("base64")}`
    }
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
    upsert: false
  });

  if (error) {
    console.error("[whatsapp media] upload failed", error.message);
    return null;
  }

  const { data } = opts.supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

export function shouldSkipMediaType(contentType: string) {
  const type = contentType.toLowerCase().trim();
  if (!type || type === "application/octet-stream") return false;
  return !type.startsWith("image/");
}

function extensionFromTypes(declared: string, fetched: string) {
  const t = `${declared} ${fetched}`.toLowerCase();
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  if (t.includes("gif")) return "gif";
  if (t.includes("heic") || t.includes("heif")) return "heic";
  return "jpg";
}
