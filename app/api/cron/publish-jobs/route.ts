import { NextResponse } from "next/server";
import { mapSubmission } from "@/lib/map-submission";
import { publishSubmissionToInstagram } from "@/lib/instagram";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { InstagramConnection, PublishJob } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const supabase = createServiceRoleClient();
  const { data: jobs, error } = await supabase
    .from("publish_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const job of (jobs ?? []) as PublishJob[]) {
    results.push(await processJob(supabase, job, new URL(request.url).origin));
  }

  return NextResponse.json({ processed: results.length, results });
}

export async function GET(request: Request) {
  return POST(request);
}

async function processJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  job: PublishJob,
  publicOrigin: string
) {
  await supabase
    .from("publish_jobs")
    .update({
      status: "running",
      attempt_count: job.attempt_count + 1,
      last_error: null
    })
    .eq("id", job.id);

  await supabase.from("submissions").update({ status: "publishing" }).eq("id", job.submission_id);

  try {
    const [{ data: submissionRow }, { data: connection }] = await Promise.all([
      supabase.from("submissions").select("*").eq("id", job.submission_id).single(),
      supabase
        .from("instagram_connections")
        .select("*")
        .eq("organisation_id", job.organisation_id)
        .single()
    ]);

    if (!submissionRow) throw new Error("Submission not found.");
    if (!connection) throw new Error("Instagram connection not found.");

    const submission = mapSubmission(submissionRow as Record<string, unknown>);
    const mediaUrls = buildPublishMediaUrls(submission, publicOrigin);
    const published = await publishSubmissionToInstagram({
      submission,
      connection: connection as InstagramConnection,
      mediaUrls
    });

    await supabase
      .from("publish_jobs")
      .update({
        status: "succeeded",
        external_container_id: published.containerId,
        external_media_id: published.mediaId,
        external_permalink: published.permalink,
        finished_at: new Date().toISOString()
      })
      .eq("id", job.id);

    await supabase
      .from("submissions")
      .update({
        status: "published",
        instagram_media_id: published.mediaId,
        instagram_permalink: published.permalink
      })
      .eq("id", job.submission_id);

    await supabase.from("submission_events").insert({
      organisation_id: job.organisation_id,
      submission_id: job.submission_id,
      actor_label: "instagram",
      event_type: "published",
      details: published
    });

    return { id: job.id, status: "succeeded" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Instagram publish failed.";

    await supabase
      .from("publish_jobs")
      .update({
        status: "failed",
        last_error: message,
        finished_at: new Date().toISOString()
      })
      .eq("id", job.id);

    await supabase.from("submissions").update({ status: "failed" }).eq("id", job.submission_id);
    await supabase.from("submission_events").insert({
      organisation_id: job.organisation_id,
      submission_id: job.submission_id,
      actor_label: "instagram",
      event_type: "publish_failed",
      details: { error: message }
    });

    return { id: job.id, status: "failed", error: message };
  }
}

function buildPublishMediaUrls(submission: ReturnType<typeof mapSubmission>, publicOrigin: string) {
  const originals = submission.media_urls ?? [];
  if (!submission.media_framing || originals.length === 0) return originals;

  return originals.map((_url, index) => {
    return `${publicOrigin}/api/media/framed/${submission.id}/${index}`;
  });
}
