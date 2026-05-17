import { saveAiSettings } from "@/app/actions/style-examples";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AiSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StyleSettingsPage() {
  const env = getPublicEnv();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("organisation_ai_settings")
    .select("*")
    .eq("organisation_id", env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID)
    .maybeSingle();

  const aiSettings = settings as AiSettings | null;

  return (
    <main className="page">
      <p className="pill">Admin</p>
      <h1>Brand Voice Settings</h1>
      <p className="muted">
        Set simple guidance Gemini should use when improving WhatsApp text into Instagram captions.
      </p>

      <section className="card">
        <h2>Caption guidance</h2>
        <form action={saveAiSettings} className="grid">
          <label>
            Brand voice notes
            <textarea
              name="brand_voice_notes"
              placeholder="Example: Warm, upbeat community sports club tone. Short captions. Australian spelling. 1-3 emojis."
              defaultValue={aiSettings?.brand_voice_notes ?? ""}
            />
          </label>
          <label>
            Default hashtags
            <textarea
              name="default_hashtags"
              placeholder="Example: #YourClub #CommunitySport"
              defaultValue={aiSettings?.default_hashtags ?? ""}
            />
          </label>
          <label>
            Banned phrases
            <textarea
              name="banned_phrases"
              placeholder="Words or phrases Gemini should avoid."
              defaultValue={aiSettings?.banned_phrases ?? ""}
            />
          </label>
          <label>
            Call-to-action notes
            <textarea
              name="call_to_action_notes"
              placeholder="Example: End with a light call to action when appropriate."
              defaultValue={aiSettings?.call_to_action_notes ?? ""}
            />
          </label>
          <label>
            Gemini model
            <input name="gemini_model" defaultValue={aiSettings?.gemini_model ?? "gemini-2.5-flash-lite"} />
          </label>
          <label className="actions">
            <input
              name="auto_draft"
              type="checkbox"
              defaultChecked={aiSettings?.auto_draft ?? false}
              style={{ width: "auto" }}
            />
            Auto-improve caption after WhatsApp intake
          </label>
          <button type="submit">Save brand voice settings</button>
        </form>
      </section>
    </main>
  );
}
