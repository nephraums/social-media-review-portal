import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCaptionDraft } from "@/lib/gemini";
import { mapSubmission } from "@/lib/map-submission";
import type { AiSettings } from "@/lib/types";

export async function draftSubmissionCaption(opts: {
  supabase: SupabaseClient;
  submissionId: string;
  reviewerNotes?: string;
  actorUserId?: string | null;
}) {
  const { data: row, error: submissionError } = await opts.supabase
    .from("submissions")
    .select("*")
    .eq("id", opts.submissionId)
    .single();

  if (submissionError || !row) {
    throw new Error(submissionError?.message ?? "Submission not found.");
  }

  const submission = mapSubmission(row as Record<string, unknown>);

  await opts.supabase
    .from("submissions")
    .update({ status: "drafting", ai_error: null })
    .eq("id", opts.submissionId);

  const { data: aiSettingsRow } = await opts.supabase
    .from("organisation_ai_settings")
    .select("*")
    .eq("organisation_id", submission.organisation_id)
    .maybeSingle();

  try {
    const result = await generateCaptionDraft({
      submission,
      aiSettings: (aiSettingsRow as AiSettings | null) ?? null,
      reviewerNotes: opts.reviewerNotes
    });

    await opts.supabase
      .from("submissions")
      .update({
        draft_caption: result.response.caption,
        final_caption: result.response.caption,
        ai_model: result.model,
        ai_error: null,
        status: "pending_review"
      })
      .eq("id", opts.submissionId);

    await opts.supabase.from("submission_events").insert({
      organisation_id: submission.organisation_id,
      submission_id: submission.id,
      actor_user_id: opts.actorUserId ?? null,
      actor_label: opts.actorUserId ? "reviewer" : "system",
      event_type: "caption_improved",
      details: {
        model: result.model,
        alt_text: result.response.alt_text,
        hashtags: result.response.hashtags,
        confidence_notes: result.response.confidence_notes
      }
    });

    return result.response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gemini drafting failed.";
    await opts.supabase
      .from("submissions")
      .update({
        status: "failed",
        ai_error: message
      })
      .eq("id", opts.submissionId);

    await opts.supabase.from("submission_events").insert({
      organisation_id: submission.organisation_id,
      submission_id: submission.id,
      actor_user_id: opts.actorUserId ?? null,
      actor_label: opts.actorUserId ? "reviewer" : "system",
      event_type: "draft_failed",
      details: { error: message }
    });

    throw error;
  }
}
