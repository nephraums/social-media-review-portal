import type { InstagramConnection, Submission } from "@/lib/types";

type GraphResponse = Record<string, unknown>;

export class InstagramApiError extends Error {
  constructor(
    message: string,
    readonly response?: unknown
  ) {
    super(message);
  }
}

export async function exchangeCodeForAccessToken(code: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v22.0";

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Meta OAuth environment variables are not configured.");
  }

  const params = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code
  });

  return graphFetch(`https://graph.facebook.com/${graphVersion}/oauth/access_token?${params}`);
}

export async function publishSubmissionToInstagram(opts: {
  submission: Submission;
  connection: InstagramConnection;
  mediaUrls?: string[];
}) {
  const images = opts.mediaUrls ?? opts.submission.media_urls ?? [];
  const caption = opts.submission.final_caption || opts.submission.draft_caption || opts.submission.brief;

  if (images.length === 0) {
    throw new Error("Submission has no media URLs to publish.");
  }

  if (images.length === 1) {
    const container = await createMediaContainer({
      instagramUserId: opts.connection.instagram_user_id,
      accessToken: opts.connection.access_token,
      imageUrl: images[0],
      caption
    });
    const published = await publishMedia({
      instagramUserId: opts.connection.instagram_user_id,
      accessToken: opts.connection.access_token,
      creationId: String(container.id)
    });
    const permalink = await getPermalink(String(published.id), opts.connection.access_token);

    return {
      containerId: String(container.id),
      mediaId: String(published.id),
      permalink
    };
  }

  const children = [];
  for (const imageUrl of images.slice(0, 10)) {
    const child = await createMediaContainer({
      instagramUserId: opts.connection.instagram_user_id,
      accessToken: opts.connection.access_token,
      imageUrl,
      isCarouselItem: true
    });
    children.push(String(child.id));
  }

  const parent = await createCarouselContainer({
    instagramUserId: opts.connection.instagram_user_id,
    accessToken: opts.connection.access_token,
    children,
    caption
  });
  const published = await publishMedia({
    instagramUserId: opts.connection.instagram_user_id,
    accessToken: opts.connection.access_token,
    creationId: String(parent.id)
  });
  const permalink = await getPermalink(String(published.id), opts.connection.access_token);

  return {
    containerId: String(parent.id),
    mediaId: String(published.id),
    permalink
  };
}

async function createMediaContainer(opts: {
  instagramUserId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
  isCarouselItem?: boolean;
}) {
  const params = new URLSearchParams({
    image_url: opts.imageUrl,
    access_token: opts.accessToken
  });
  if (opts.caption) params.set("caption", opts.caption);
  if (opts.isCarouselItem) params.set("is_carousel_item", "true");

  return graphFetch(mediaEndpoint(opts.instagramUserId), {
    method: "POST",
    body: params
  });
}

async function createCarouselContainer(opts: {
  instagramUserId: string;
  accessToken: string;
  children: string[];
  caption: string;
}) {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: opts.children.join(","),
    caption: opts.caption,
    access_token: opts.accessToken
  });

  return graphFetch(mediaEndpoint(opts.instagramUserId), {
    method: "POST",
    body: params
  });
}

async function publishMedia(opts: { instagramUserId: string; accessToken: string; creationId: string }) {
  const params = new URLSearchParams({
    creation_id: opts.creationId,
    access_token: opts.accessToken
  });

  return graphFetch(`${mediaEndpoint(opts.instagramUserId)}_publish`, {
    method: "POST",
    body: params
  });
}

async function getPermalink(mediaId: string, accessToken: string) {
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v22.0";
  const params = new URLSearchParams({
    fields: "permalink",
    access_token: accessToken
  });
  const data = await graphFetch(`https://graph.facebook.com/${graphVersion}/${mediaId}?${params}`);
  return typeof data.permalink === "string" ? data.permalink : null;
}

function mediaEndpoint(instagramUserId: string) {
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v22.0";
  return `https://graph.facebook.com/${graphVersion}/${instagramUserId}/media`;
}

async function graphFetch(url: string, init?: RequestInit): Promise<GraphResponse> {
  const res = await fetch(url, init);
  const data = (await res.json()) as GraphResponse;

  if (!res.ok || data.error) {
    throw new InstagramApiError("Instagram Graph API request failed.", data);
  }

  return data;
}
