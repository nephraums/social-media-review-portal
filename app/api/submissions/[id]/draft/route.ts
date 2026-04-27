import { NextResponse } from "next/server";
import { z } from "zod";
import { draftSubmissionCaption } from "@/lib/drafting";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z
  .object({
    regenerate: z.boolean().optional(),
    reviewer_notes: z.string().optional()
  })
  .optional();

export async function POST(
  request: Request,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const payload = requestSchema.parse(await request.json().catch(() => undefined));
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const draft = await draftSubmissionCaption({
      supabase,
      submissionId: id,
      reviewerNotes: payload?.reviewer_notes,
      actorUserId: user.id
    });

    return NextResponse.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft generation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
