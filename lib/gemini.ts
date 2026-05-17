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
  return `You improve short parent-submitted WhatsApp text into Instagram captions for a sports club.

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
- The submitted WhatsApp text is the ONLY source of event facts.
- Caption Helper settings below are reusable style/helper guidance only. They are NOT facts about this week's post.
- Do not treat any club names, opposition names, people, places, sponsors, events, or example wording in the settings as current-post facts.
- Do not invent opposition names, player names, team names, dates, scores, locations, sponsors, awards, injuries, events, or outcomes.
- If a fact is not explicitly present in the submitted WhatsApp text, leave it out.
- Keep it suitable for Instagram and easy for a reviewer to edit.
- Use frequent hashtags and preferred emojis only when appropriate.
- Keep the caption polished, friendly, and concise.

Submitted WhatsApp text:
${opts.submission.brief}

Reviewer notes or current caption:
${opts.reviewerNotes || "None"}

Caption style and preferred emojis (style guidance only, not event facts):
${opts.aiSettings?.brand_voice_notes || "None"}

Frequent hashtags (optional helper only):
${opts.aiSettings?.default_hashtags || "None"}

Things to avoid:
${opts.aiSettings?.banned_phrases || "None"}

Default call-to-action guidance:
${opts.aiSettings?.call_to_action_notes || "None"}`;
}
