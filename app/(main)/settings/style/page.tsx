import {
  deleteStyleExample,
  saveAiSettings,
  saveStyleExample
} from "@/app/actions/style-examples";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AiSettings, StyleExample } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StyleSettingsPage() {
  const env = getPublicEnv();
  const supabase = await createClient();

  const [{ data: examples }, { data: settings }] = await Promise.all([
    supabase
      .from("style_examples")
      .select("*")
      .eq("organisation_id", env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID)
      .order("created_at", { ascending: false }),
    supabase
      .from("organisation_ai_settings")
      .select("*")
      .eq("organisation_id", env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID)
      .maybeSingle()
  ]);

  const aiSettings = settings as AiSettings | null;
  const styleExamples = (examples ?? []) as StyleExample[];

  return (
    <main className="page">
      <p className="pill">Admin</p>
      <h1>Learning Area</h1>
      <p className="muted">Save previous posts and voice notes so Gemini can draft closer captions.</p>

      <div className="grid two">
        <section className="card">
          <h2>AI settings</h2>
          <form action={saveAiSettings} className="grid">
            <label>
              Brand voice notes
              <textarea name="brand_voice_notes" defaultValue={aiSettings?.brand_voice_notes ?? ""} />
            </label>
            <label>
              Default hashtags
              <textarea name="default_hashtags" defaultValue={aiSettings?.default_hashtags ?? ""} />
            </label>
            <label>
              Banned phrases
              <textarea name="banned_phrases" defaultValue={aiSettings?.banned_phrases ?? ""} />
            </label>
            <label>
              Call-to-action notes
              <textarea name="call_to_action_notes" defaultValue={aiSettings?.call_to_action_notes ?? ""} />
            </label>
            <label>
              Gemini model
              <input name="gemini_model" defaultValue={aiSettings?.gemini_model ?? "gemini-2.0-flash"} />
            </label>
            <label className="actions">
              <input
                name="auto_draft"
                type="checkbox"
                defaultChecked={aiSettings?.auto_draft ?? true}
                style={{ width: "auto" }}
              />
              Auto-draft after WhatsApp intake
            </label>
            <button type="submit">Save settings</button>
          </form>
        </section>

        <section className="card">
          <h2>Add style example</h2>
          <form action={saveStyleExample} className="grid">
            <label>
              Label
              <input name="label" placeholder="Grand final win, sponsor post, player profile..." />
            </label>
            <label>
              Previous post text
              <textarea name="post_text" required />
            </label>
            <label>
              Notes
              <textarea name="notes" />
            </label>
            <button type="submit">Add example</button>
          </form>
        </section>
      </div>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2>Saved examples</h2>
        {styleExamples.length === 0 ? (
          <p className="muted">No examples saved yet.</p>
        ) : (
          <div className="grid">
            {styleExamples.map((example) => (
              <article className="card" key={example.id}>
                <form action={saveStyleExample} className="grid">
                  <input type="hidden" name="id" value={example.id} />
                  <label>
                    Label
                    <input name="label" defaultValue={example.label ?? ""} />
                  </label>
                  <label>
                    Post text
                    <textarea name="post_text" defaultValue={example.post_text} required />
                  </label>
                  <label>
                    Notes
                    <textarea name="notes" defaultValue={example.notes ?? ""} />
                  </label>
                  <div className="actions">
                    <button type="submit">Update</button>
                    <button formAction={deleteStyleExample} name="id" value={example.id} className="danger">
                      Delete
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
