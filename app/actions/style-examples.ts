"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function saveStyleExample(formData: FormData) {
  const schema = z.object({
    id: z.string().uuid().optional(),
    label: z.string().optional(),
    post_text: z.string().min(1),
    notes: z.string().optional()
  });
  const payload = schema.parse({
    id: optionalString(formData.get("id")),
    label: optionalString(formData.get("label")),
    post_text: String(formData.get("post_text") ?? "").trim(),
    notes: optionalString(formData.get("notes"))
  });
  const env = getPublicEnv();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in.");

  if (payload.id) {
    const { error } = await supabase
      .from("style_examples")
      .update({
        label: payload.label,
        post_text: payload.post_text,
        notes: payload.notes
      })
      .eq("id", payload.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("style_examples").insert({
      organisation_id: env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID,
      label: payload.label,
      post_text: payload.post_text,
      notes: payload.notes,
      created_by: user.id
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/settings/style");
}

export async function deleteStyleExample(formData: FormData) {
  const id = z.string().uuid().parse(String(formData.get("id")));
  const supabase = await createClient();
  const { error } = await supabase.from("style_examples").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/style");
}

export async function saveAiSettings(formData: FormData) {
  const env = getPublicEnv();
  const supabase = await createClient();
  const payload = {
    organisation_id: env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID,
    brand_voice_notes: optionalString(formData.get("brand_voice_notes")),
    default_hashtags: optionalString(formData.get("default_hashtags")),
    banned_phrases: optionalString(formData.get("banned_phrases")),
    call_to_action_notes: optionalString(formData.get("call_to_action_notes")),
    auto_draft: formData.get("auto_draft") === "on",
    gemini_model: optionalString(formData.get("gemini_model")) ?? "gemini-2.0-flash"
  };

  const { error } = await supabase.from("organisation_ai_settings").upsert(payload);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/style");
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}
