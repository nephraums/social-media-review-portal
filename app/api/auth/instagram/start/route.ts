import { NextResponse } from "next/server";

export async function GET() {
  const appId = process.env.META_APP_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v22.0";

  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "META_APP_ID and INSTAGRAM_REDIRECT_URI must be configured." },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"
  });

  return NextResponse.redirect(`https://www.facebook.com/${graphVersion}/dialog/oauth?${params}`);
}
