"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseMediaFraming, parseStringArray } from "@/lib/map-submission";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const mediaItemSchema = z.object({
  url: z.string().url(),
  path: z.string().nullable()
});

export async function saveSubmissionMediaOrder(submissionId: string, mediaItems: unknown) {
  const id = z.string().uuid().parse(submissionId);
  const items = z.array(mediaItemSchema).parse(mediaItems);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in.");
  }

  const { data: submission, error: readError } = await supabase
    .from("submissions")
    .select("organisation_id, media_urls, media_paths, media_framing")
    .eq("id", id)
    .single();

  if (readError || !submission) {
    throw new Error(readError?.message ?? "Submission not found.");
  }

  const previousUrls = parseStringArray(submission.media_urls);
  const previousPaths = parseStringArray(submission.media_paths);
  const nextUrls = items.map((item) => item.url);
  const nextPaths = items.map((item) => item.path).filter((path): path is string => Boolean(path));
  const nextUrlSet = new Set(nextUrls);
  const removedPaths = previousPaths.filter((_, index) => !nextUrlSet.has(previousUrls[index]));
  const previousFraming = parseMediaFraming(submission.media_framing);
  const nextFraming = previousFraming
    ? Object.fromEntries(Object.entries(previousFraming).filter(([url]) => nextUrlSet.has(url)))
    : null;

  const admin = createServiceRoleClient();
  const { error: updateError } = await admin
    .from("submissions")
    .update({
      media_urls: nextUrls.length > 0 ? nextUrls : null,
      media_paths: nextPaths.length > 0 ? nextPaths : null,
      media_framing: nextFraming
    })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (removedPaths.length > 0) {
    await admin.storage.from("organisation-media").remove(removedPaths);
  }

  await admin.from("submission_events").insert({
    organisation_id: submission.organisation_id,
    submission_id: id,
    actor_user_id: user.id,
    actor_label: "reviewer",
    event_type: "media_order_saved",
    details: {
      media_count: nextUrls.length,
      removed_count: removedPaths.length
    }
  });

  revalidatePath(`/submissions/${id}`);
}
