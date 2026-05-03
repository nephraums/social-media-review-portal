import { NextResponse } from "next/server";
import sharp from "sharp";
import { mapSubmission } from "@/lib/map-submission";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { MediaFrameSettings } from "@/lib/types";

export const runtime = "nodejs";

const OUTPUT_WIDTH = 1080;
const OUTPUT_HEIGHT = 1920;
const DEFAULT_SETTINGS: MediaFrameSettings = {
  mode: "cover",
  zoom: 1,
  x: 0,
  y: 0
};

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ submissionId: string; index: string }>;
  }
) {
  const { submissionId, index } = await params;
  const mediaIndex = Number.parseInt(index, 10);

  if (!Number.isInteger(mediaIndex) || mediaIndex < 0) {
    return NextResponse.json({ error: "Invalid media index." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("submissions").select("*").eq("id", submissionId).single();

  if (error || !data) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }

  const submission = mapSubmission(data as Record<string, unknown>);
  const sourceUrl = submission.media_urls?.[mediaIndex];

  if (!sourceUrl) {
    return NextResponse.json({ error: "Media not found." }, { status: 404 });
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    return NextResponse.json({ error: "Could not fetch source media." }, { status: 502 });
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const settings = submission.media_framing?.[sourceUrl] ?? DEFAULT_SETTINGS;
  const output = await renderFramedImage(sourceBuffer, settings);

  return new Response(new Uint8Array(output), {
    headers: {
      "cache-control": "public, max-age=300, s-maxage=300",
      "content-type": "image/jpeg"
    }
  });
}

async function renderFramedImage(sourceBuffer: Buffer, settings: MediaFrameSettings) {
  const metadata = await sharp(sourceBuffer).metadata();
  const sourceWidth = metadata.width ?? OUTPUT_WIDTH;
  const sourceHeight = metadata.height ?? OUTPUT_HEIGHT;
  const baseScale =
    settings.mode === "contain"
      ? Math.min(OUTPUT_WIDTH / sourceWidth, OUTPUT_HEIGHT / sourceHeight)
      : Math.max(OUTPUT_WIDTH / sourceWidth, OUTPUT_HEIGHT / sourceHeight);
  const scale = baseScale * settings.zoom;
  const resizedWidth = Math.max(1, Math.round(sourceWidth * scale));
  const resizedHeight = Math.max(1, Math.round(sourceHeight * scale));
  const left = Math.round((OUTPUT_WIDTH - resizedWidth) / 2 + (settings.x / 100) * OUTPUT_WIDTH);
  const top = Math.round((OUTPUT_HEIGHT - resizedHeight) / 2 + (settings.y / 100) * OUTPUT_HEIGHT);

  const resized = await sharp(sourceBuffer)
    .rotate()
    .resize(resizedWidth, resizedHeight, { fit: "fill" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return sharp({
    create: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      channels: 3,
      background: "#111827"
    }
  })
    .composite([{ input: resized, left, top }])
    .jpeg({ quality: 90 })
    .toBuffer();
}
