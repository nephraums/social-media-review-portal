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
      <h1>Caption Helper</h1>
      <p className="muted">
        Give Gemini practical helpers for polishing parent-submitted WhatsApp text. These settings
        guide style only; facts must still come from each submission.
      </p>

      <section className="card">
        <h2>Reusable caption helpers</h2>
        <form action={saveAiSettings} className="grid">
          <label>
            Caption style and preferred emojis
            <textarea
              name="brand_voice_notes"
              placeholder="Warm, positive, community-focused. Keep captions short and friendly. Preferred emojis: 🔵 ⚪ 🏉 👏 🙌"
              defaultValue={aiSettings?.brand_voice_notes ?? ""}
            />
          </label>
          <label>
            Frequent hashtags
            <textarea
              name="default_hashtags"
              placeholder="#YourClub #JuniorSport #CommunityFooty"
              defaultValue={aiSettings?.default_hashtags ?? ""}
            />
          </label>
          <label>
            Things to avoid
            <textarea
              name="banned_phrases"
              placeholder="Do not mention scores unless supplied. Do not invent player names. Do not mention opposition unless supplied."
              defaultValue={aiSettings?.banned_phrases ?? ""}
            />
          </label>
          <label>
            Default call-to-action guidance
            <textarea
              name="call_to_action_notes"
              placeholder="Thank volunteers, families, and supporters when appropriate."
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
          <button type="submit">Save Caption Helper settings</button>
        </form>
      </section>
    </main>
  );
}
