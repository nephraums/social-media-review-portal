import Link from "next/link";
import { saveInstagramConnection } from "@/app/actions/instagram";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { InstagramConnection } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InstagramSettingsPage() {
  const env = getPublicEnv();
  const supabase = await createClient();
  const { data } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("organisation_id", env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID)
    .maybeSingle();

  const connection = data as InstagramConnection | null;

  return (
    <main className="page">
      <p className="pill">Admin</p>
      <h1>Instagram publishing</h1>
      <p className="muted">
        Store the organisation Instagram connection. OAuth routes are scaffolded for production,
        while this form supports env-backed prototype credentials.
      </p>

      <div className="grid two">
        <section className="card">
          <h2>Connection</h2>
          {connection ? (
            <p className="notice">
              Connected to {connection.instagram_username ?? connection.instagram_user_id}. Token is
              stored server-side in Supabase.
            </p>
          ) : (
            <p className="muted">No Instagram connection stored yet.</p>
          )}
          <p>
            <Link className="button secondary" href="/api/auth/instagram/start">
              Start Meta OAuth
            </Link>
          </p>
        </section>

        <section className="card">
          <h2>Prototype connection</h2>
          <form action={saveInstagramConnection} className="grid">
            <label>
              Instagram user ID
              <input
                name="instagram_user_id"
                defaultValue={connection?.instagram_user_id ?? process.env.INSTAGRAM_USER_ID ?? ""}
                required
              />
            </label>
            <label>
              Instagram username
              <input
                name="instagram_username"
                defaultValue={connection?.instagram_username ?? process.env.INSTAGRAM_USERNAME ?? ""}
              />
            </label>
            <label>
              Facebook page ID
              <input name="facebook_page_id" defaultValue={connection?.facebook_page_id ?? ""} />
            </label>
            <label>
              Access token
              <textarea
                name="access_token"
                defaultValue={connection?.access_token ?? process.env.INSTAGRAM_ACCESS_TOKEN ?? ""}
                required
              />
            </label>
            <button type="submit">Save connection</button>
          </form>
        </section>
      </div>
    </main>
  );
}
