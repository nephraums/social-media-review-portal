import type { Submission } from "@/lib/types";

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
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
