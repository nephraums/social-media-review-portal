import Link from "next/link";
import { deleteSubmission } from "@/app/actions/submissions";
import { getPublicEnv } from "@/lib/env";
import { mapSubmission } from "@/lib/map-submission";
import { createClient } from "@/lib/supabase/server";
import type { Submission, SubmissionStatus } from "@/lib/types";

type DashboardFilter = {
  key: "pending_review" | "approved_published" | "failed";
  label: string;
  statuses: SubmissionStatus[];
};

const filters: DashboardFilter[] = [
  { key: "pending_review", label: "Pending Review", statuses: ["pending_review"] },
  {
    key: "approved_published",
    label: "Approved / Published",
    statuses: ["approved", "publishing", "published"]
  },
  { key: "failed", label: "Failed", statuses: ["failed"] }
];

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: DashboardFilter["key"] }>;
}) {
  const params = await searchParams;
  const selectedFilter =
    filters.find((filter) => filter.key === params?.status) ?? filters[0];
  const env = getPublicEnv();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .eq("organisation_id", env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID)
    .in("status", selectedFilter.statuses)
    .order("created_at", { ascending: false });

  const submissions = (data ?? []).map((row) => mapSubmission(row as Record<string, unknown>));
  const groupedSubmissions = groupSubmissionsByWeek(submissions);

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
        {filters.map((filter) => (
          <Link
            className={`button ${filter.key === selectedFilter.key ? "" : "secondary"}`}
            href={`/?status=${filter.key}`}
            key={filter.key}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <section className="card">
        {error ? <p className="notice">{error.message}</p> : null}
        {submissions.length === 0 ? (
          <p className="muted">No submissions found for this status.</p>
        ) : (
          <div className="week-groups">
            {groupedSubmissions.map((group) => (
              <section className="week-group" key={group.label}>
                <h2>{group.label}</h2>
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
                    {group.submissions.map((submission) => (
                      <tr key={submission.id}>
                        <td>{new Date(submission.created_at).toLocaleString()}</td>
                        <td>{submission.brief}</td>
                        <td>{submission.whatsapp_from ?? "Unknown"}</td>
                        <td>
                          <span className="pill">{formatStatus(submission.status)}</span>
                        </td>
                        <td>
                          <div className="actions">
                            <Link className="button review-button compact-button" href={`/submissions/${submission.id}`}>
                              Review
                            </Link>
                            {selectedFilter.key === "pending_review" ? (
                              <form action={deleteSubmission}>
                                <input type="hidden" name="id" value={submission.id} />
                                <button className="danger compact-button" type="submit">
                                  Delete
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function groupSubmissionsByWeek(submissions: Submission[]) {
  const groups = new Map<string, Submission[]>();

  for (const submission of submissions) {
    const label = getWeekLabel(new Date(submission.created_at));
    groups.set(label, [...(groups.get(label) ?? []), submission]);
  }

  return Array.from(groups.entries()).map(([label, groupSubmissions]) => ({
    label,
    submissions: groupSubmissions
  }));
}

function getWeekLabel(date: Date) {
  const monday = startOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return `Week of ${monday.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  })} - ${sunday.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  })}`;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatStatus(status: SubmissionStatus) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
