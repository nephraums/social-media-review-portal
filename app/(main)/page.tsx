import Link from "next/link";
import { getPublicEnv } from "@/lib/env";
import { mapSubmission } from "@/lib/map-submission";
import { createClient } from "@/lib/supabase/server";
import type { SubmissionStatus } from "@/lib/types";

const statuses: SubmissionStatus[] = [
  "pending_review",
  "approved",
  "rejected",
  "published",
  "failed"
];

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: SubmissionStatus }>;
}) {
  const params = await searchParams;
  const selectedStatus = params?.status && statuses.includes(params.status) ? params.status : "pending_review";
  const env = getPublicEnv();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("organisation_id", env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID)
    .eq("status", selectedStatus)
    .order("created_at", { ascending: false });

  const submissions = (data ?? []).map((row) => mapSubmission(row as Record<string, unknown>));

  return (
    <main className="page">
      <div className="actions" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="pill">Dashboard</p>
          <h1>Submissions</h1>
          <p className="muted">Filter review work by status and open each submission for editing.</p>
        </div>
      </div>

      <div className="actions" style={{ margin: "1rem 0" }}>
        {statuses.map((status) => (
          <Link
            className={`button ${status === selectedStatus ? "" : "secondary"}`}
            href={`/?status=${status}`}
            key={status}
          >
            {status.replace("_", " ")}
          </Link>
        ))}
      </div>

      <section className="card">
        {error ? <p className="notice">{error.message}</p> : null}
        {submissions.length === 0 ? (
          <p className="muted">No submissions found for this status.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Brief</th>
                <th>Submitter</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td>{new Date(submission.created_at).toLocaleString()}</td>
                  <td>{submission.brief}</td>
                  <td>{submission.whatsapp_from ?? "Unknown"}</td>
                  <td>
                    <span className="pill">{submission.status}</span>
                  </td>
                  <td>
                    <Link href={`/submissions/${submission.id}`}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
