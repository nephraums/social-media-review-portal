import type { MediaFraming, Submission } from "@/lib/types";

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function parseMediaFraming(value: unknown): MediaFraming | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value as Record<string, unknown>)
    .map(([url, settings]) => {
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) return null;
      const data = settings as Record<string, unknown>;
      const mode = data.mode === "cover" ? "cover" : "contain";
      const zoom = clampNumber(data.zoom, 1, 2.5, 1);
      const x = clampNumber(data.x, -40, 40, 0);
      const y = clampNumber(data.y, -40, 40, 0);

      return [url, { mode, zoom, x, y }] as const;
    })
    .filter((entry): entry is readonly [string, MediaFraming[string]] => Boolean(entry));

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function mapSubmission(row: Record<string, unknown>): Submission {
  return {
    id: String(row.id),
    organisation_id: String(row.organisation_id),
    submitter_id: (row.submitter_id as string | null) ?? null,
    whatsapp_from: (row.whatsapp_from as string | null) ?? null,
    source: String(row.source ?? "whatsapp"),
    brief: String(row.brief ?? ""),
    status: row.status as Submission["status"],
    media_urls: parseStringArray(row.media_urls),
    media_paths: parseStringArray(row.media_paths),
    media_framing: parseMediaFraming(row.media_framing),
    draft_caption: (row.draft_caption as string | null) ?? null,
    final_caption: (row.final_caption as string | null) ?? null,
    ai_model: (row.ai_model as string | null) ?? null,
    ai_error: (row.ai_error as string | null) ?? null,
    rejection_reason: (row.rejection_reason as string | null) ?? null,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    instagram_media_id: (row.instagram_media_id as string | null) ?? null,
    instagram_permalink: (row.instagram_permalink as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
}
