"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const frameSettingsSchema = z.object({
  mode: z.enum(["contain", "cover"]),
  zoom: z.number().min(1).max(2.5),
  x: z.number().min(-40).max(40),
  y: z.number().min(-40).max(40)
});

const mediaFramingSchema = z.record(z.string().url(), frameSettingsSchema);

export async function saveMediaFraming(submissionId: string, mediaFraming: unknown) {
  const id = z.string().uuid().parse(submissionId);
  const framing = mediaFramingSchema.parse(mediaFraming);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in.");
  }

  const { data: submission, error: readError } = await supabase
    .from("submissions")
    .select("organisation_id")
    .eq("id", id)
    .single();

  if (readError || !submission) {
    throw new Error(readError?.message ?? "Submission not found.");
  }

  const { error } = await supabase
    .from("submissions")
    .update({ media_framing: framing })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  await supabase.from("submission_events").insert({
    organisation_id: submission.organisation_id,
    submission_id: id,
    actor_user_id: user.id,
    actor_label: "reviewer",
    event_type: "media_framing_saved",
    details: framing
  });

  revalidatePath(`/submissions/${id}`);
}
