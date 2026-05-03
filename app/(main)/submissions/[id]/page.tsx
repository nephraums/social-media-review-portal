import Link from "next/link";
import { notFound } from "next/navigation";
import { mapSubmission } from "@/lib/map-submission";
import { createClient } from "@/lib/supabase/server";
import type { PublishJob, SubmissionEvent } from "@/lib/types";
import { SubmissionReviewTabs } from "./submission-review-tabs";

export const dynamic = "force-dynamic";

export default async function SubmissionDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: row, error } = await supabase.from("submissions").select("*").eq("id", id).single();
  if (error || !row) notFound();

  const submission = mapSubmission(row as Record<string, unknown>);
  const [{ data: eventRows }, { data: jobRows }] = await Promise.all([
    supabase
      .from("submission_events")
      .select("*")
      .eq("submission_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("publish_jobs")
      .select("*")
      .eq("submission_id", id)
      .order("created_at", { ascending: false })
  ]);

  const events = (eventRows ?? []) as SubmissionEvent[];
  const jobs = (jobRows ?? []) as PublishJob[];
  const mediaUrls = submission.media_urls ?? [];

  return (
    <main className="page">
      <Link href="/">&larr; Back to dashboard</Link>
      <header className="review-header">
        <p className="pill">{submission.status}</p>
        <h1>Review submission</h1>
        <p className="muted">
          Submitted {new Date(submission.created_at).toLocaleString()} by{" "}
          {submission.whatsapp_from ?? "unknown submitter"}.
        </p>
        {submission.rejection_reason ? (
          <p className="notice">Rejected: {submission.rejection_reason}</p>
        ) : null}
        {submission.instagram_permalink ? (
          <p>
            Published: <a href={submission.instagram_permalink}>{submission.instagram_permalink}</a>
          </p>
        ) : null}
      </header>

      <SubmissionReviewTabs
        submission={submission}
        mediaUrls={mediaUrls}
        initialFraming={submission.media_framing}
      />

      <div className="grid two" style={{ marginTop: "1rem" }}>
        <section className="card">
          <h2>Publish jobs</h2>
          {jobs.length === 0 ? (
            <p className="muted">No publish jobs yet.</p>
          ) : (
            <table className="table">
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <span className="pill">{job.status}</span>
                    </td>
                    <td>{job.last_error ?? job.external_permalink ?? job.external_media_id ?? "Queued"}</td>
                    <td>{new Date(job.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <h2>Events</h2>
          {events.length === 0 ? (
            <p className="muted">No events recorded yet.</p>
          ) : (
            <div className="grid">
              {events.map((event) => (
                <div key={event.id}>
                  <strong>{event.event_type}</strong>
                  <div className="muted">{new Date(event.created_at).toLocaleString()}</div>
                  {event.details ? <pre>{JSON.stringify(event.details, null, 2)}</pre> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
