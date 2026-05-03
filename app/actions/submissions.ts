"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { draftSubmissionCaption } from "@/lib/drafting";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.string().uuid();

export async function saveCaption(formData: FormData) {
  const id = idSchema.parse(String(formData.get("id")));
  const finalCaption = z.string().min(1).parse(String(formData.get("final_caption") ?? "").trim());
  const { supabase, user } = await getAuthedContext();

  const { error } = await supabase
    .from("submissions")
    .update({ final_caption: finalCaption })
    .eq("id", id);

  if (error) throw new Error(error.message);

  await recordEvent(supabase, id, user.id, "caption_saved", { final_caption: finalCaption });
  revalidateSubmission(id);
}

export async function approveSubmission(formData: FormData) {
  const id = idSchema.parse(String(formData.get("id")));
  const finalCaption = z.string().min(1).parse(String(formData.get("final_caption") ?? "").trim());
  const { supabase, user } = await getAuthedContext();

  const { data: submission, error } = await supabase
    .from("submissions")
    .update({
      status: "approved",
      final_caption: finalCaption,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id, organisation_id")
    .single();

  if (error || !submission) throw new Error(error?.message ?? "Submission not found.");

  await supabase.from("publish_jobs").insert({
    organisation_id: submission.organisation_id,
    submission_id: submission.id,
    requested_by: user.id,
    status: "queued",
    platform: "instagram"
  });

  await recordEvent(supabase, id, user.id, "approved", { final_caption: finalCaption });
  revalidateSubmission(id);
}

export async function deleteSubmission(formData: FormData) {
  const id = idSchema.parse(String(formData.get("id")));
  const { supabase, user } = await getAuthedContext();

  const { data: submission, error: readError } = await supabase
    .from("submissions")
    .select("id, organisation_id, media_paths")
    .eq("id", id)
    .single();

  if (readError || !submission) throw new Error(readError?.message ?? "Submission not found.");

  const admin = createServiceRoleClient();
  const paths = Array.isArray(submission.media_paths)
    ? submission.media_paths.filter((path): path is string => typeof path === "string")
    : [];

  if (paths.length > 0) {
    await admin.storage.from("organisation-media").remove(paths);
  }

  await admin.from("submission_events").insert({
    organisation_id: submission.organisation_id,
    submission_id: id,
    actor_user_id: user.id,
    actor_label: "reviewer",
    event_type: "deleted",
    details: { media_count: paths.length }
  });

  const { error } = await admin.from("submissions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
}

export async function regenerateDraft(formData: FormData) {
  const id = idSchema.parse(String(formData.get("id")));
  const reviewerNotes = String(formData.get("reviewer_notes") ?? "").trim();
  const { supabase, user } = await getAuthedContext();

  await draftSubmissionCaption({
    supabase,
    submissionId: id,
    reviewerNotes,
    actorUserId: user.id
  });

  revalidateSubmission(id);
}

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in.");
  }

  return { supabase, user };
}

async function recordEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  submissionId: string,
  userId: string,
  eventType: string,
  details: Record<string, unknown>
) {
  const { data: submission } = await supabase
    .from("submissions")
    .select("organisation_id")
    .eq("id", submissionId)
    .single();

  if (!submission) return;

  await supabase.from("submission_events").insert({
    organisation_id: submission.organisation_id,
    submission_id: submissionId,
    actor_user_id: userId,
    actor_label: "reviewer",
    event_type: eventType,
    details
  });
}

function revalidateSubmission(id: string) {
  revalidatePath("/");
  revalidatePath(`/submissions/${id}`);
}
