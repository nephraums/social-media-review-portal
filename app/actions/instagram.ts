"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function saveInstagramConnection(formData: FormData) {
  const schema = z.object({
    instagram_user_id: z.string().min(1),
    instagram_username: z.string().optional(),
    facebook_page_id: z.string().optional(),
    access_token: z.string().min(1)
  });
  const payload = schema.parse({
    instagram_user_id: String(formData.get("instagram_user_id") ?? "").trim(),
    instagram_username: optionalString(formData.get("instagram_username")),
    facebook_page_id: optionalString(formData.get("facebook_page_id")),
    access_token: String(formData.get("access_token") ?? "").trim()
  });

  const env = getPublicEnv();
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not signed in.");

  const { error } = await supabase.from("instagram_connections").upsert({
    organisation_id: env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID,
    instagram_user_id: payload.instagram_user_id,
    instagram_username: payload.instagram_username,
    facebook_page_id: payload.facebook_page_id,
    access_token: payload.access_token,
    connected_by: user.id,
    connected_at: new Date().toISOString()
  });

  if (error) throw new Error(error.message);
  revalidatePath("/settings/instagram");
}

function optionalString(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : undefined;
}
