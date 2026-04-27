import { NextResponse } from "next/server";
import { exchangeCodeForAccessToken } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/settings/instagram?error=${encodeURIComponent(error)}`, url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/settings/instagram?error=Missing OAuth code", url));
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", url));
  }

  const tokenResponse = await exchangeCodeForAccessToken(code);
  const accessToken = String(tokenResponse.access_token ?? "");
  const instagramUserId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !instagramUserId) {
    return NextResponse.redirect(
      new URL("/settings/instagram?error=OAuth succeeded but INSTAGRAM_USER_ID is not configured", url)
    );
  }

  await supabase.from("instagram_connections").upsert({
    organisation_id: process.env.NEXT_PUBLIC_DEFAULT_ORGANISATION_ID,
    instagram_user_id: instagramUserId,
    instagram_username: process.env.INSTAGRAM_USERNAME ?? null,
    access_token: accessToken,
    connected_by: user.id,
    connected_at: new Date().toISOString()
  });

  return NextResponse.redirect(new URL("/settings/instagram", url));
}
