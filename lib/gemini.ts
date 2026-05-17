import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { AiSettings, Submission } from "@/lib/types";

export const draftResponseSchema = z.object({
  caption: z.string().min(1),
  alt_text: z.string().optional().default(""),
  hashtags: z.array(z.string()).optional().default([]),
  confidence_notes: z.string().optional().default("")
});

export type DraftResponse = z.infer<typeof draftResponseSchema>;

export async function generateCaptionDraft(opts: {
  submission: Submission;
  aiSettings: AiSettings | null;
  reviewerNotes?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = opts.aiSettings?.gemini_model ?? process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const prompt = buildPrompt(opts);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = draftResponseSchema.parse(JSON.parse(text));

  return {
    model: modelName,
    response: parsed
  };
}

function buildPrompt(opts: {
  submission: Submission;
  aiSettings: AiSettings | null;
  reviewerNotes?: string;
}) {
  return `You improve short WhatsApp submission text into Instagram captions for an organisation.

Return JSON only with this shape:
{
  "caption": "string",
  "alt_text": "string",
  "hashtags": ["string"],
  "confidence_notes": "string"
}

Rules:
- Rewrite the submitted WhatsApp text into a short Instagram caption.
- Use Australian spelling.
- Use 1-3 emojis if appropriate.
- Do not invent names, dates, scores, locations, sponsors, awards, events, or outcomes.
- Only use facts present in the submitted WhatsApp text.
- Keep it suitable for Instagram and easy for a reviewer to edit.
- If default hashtags are provided, include only the most relevant ones.

Submitted WhatsApp text:
${opts.submission.brief}

Reviewer notes or current caption:
${opts.reviewerNotes || "None"}

Organisation voice notes:
${opts.aiSettings?.brand_voice_notes || "None"}

Default hashtags:
${opts.aiSettings?.default_hashtags || "None"}

Banned phrases:
${opts.aiSettings?.banned_phrases || "None"}

Call-to-action notes:
${opts.aiSettings?.call_to_action_notes || "None"}`;
}
