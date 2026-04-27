# Gemini Style Learning

The goal is not to train a custom model. The prototype should use retrieval-style prompting: store previous posts in Supabase, fetch representative examples for the organisation, and include them in the Gemini prompt.

## Learning Area

Create an admin page:

`/settings/style`

Functions:

- Paste previous social posts.
- Add optional labels such as `match report`, `junior teams`, `sponsor`, `event`, `celebration`.
- Add notes such as "high-energy", "uses emojis", "mentions sponsors", "avoid slang".
- Edit and delete examples.
- Store examples in `style_examples`.

For the first version, fetch the latest 8-12 examples for the organisation. Later, add embeddings or tags to choose examples by submission type.

## Suggested Gemini Route

Create:

`app/api/submissions/[id]/draft/route.ts`

Inputs:

```json
{
  "regenerate": false,
  "reviewer_notes": "Optional instruction from the reviewer"
}
```

Output:

```json
{
  "caption": "string",
  "alt_text": "string",
  "hashtags": ["string"],
  "confidence_notes": "string"
}
```

Store:

- `draft_caption`
- `ai_model`
- `ai_error`
- `status = pending_review`

## Prompt Template

Use strict JSON mode and validate with `zod`.

```ts
const prompt = `
You write social media posts for a local rugby league club.

Your job:
- Turn the submitted brief into a polished Instagram caption.
- Match the tone, language, pacing, and style of the example posts.
- Keep factual details faithful to the submission.
- Do not invent scores, names, sponsors, venues, dates, or achievements.
- If the brief is missing detail, write a useful caption without making up specifics.
- Keep the tone community-minded, club-focused, and natural.
- Return JSON only. No markdown. No code fences.

Organisation:
${organisation.name}

Brand voice notes:
${settings.brand_voice_notes ?? ""}

Default hashtags:
${settings.default_hashtags ?? ""}

Banned phrases:
${settings.banned_phrases ?? ""}

Previous posts to mimic:
${styleExamples
  .map((e, i) => `Example ${i + 1}${e.label ? ` (${e.label})` : ""}:\n${e.post_text}`)
  .join("\n\n")}

Submission brief:
${submission.brief}

Photo count:
${photoCount}

Reviewer notes:
${reviewerNotes ?? ""}

Return this exact JSON shape:
{
  "caption": "Instagram caption text",
  "alt_text": "Short accessible alt text for the post",
  "hashtags": ["optional", "hashtags"],
  "confidence_notes": "One sentence noting any missing facts or assumptions"
}
`;
```

## Gemini Call Pattern

Use the same working package from the current app:

```ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash",
});

const result = await model.generateContent({
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ],
  generationConfig: {
    responseMimeType: "application/json",
  },
});

const text = result.response.text();
```

Validate the response:

```ts
const aiDraftSchema = z.object({
  caption: z.string().min(1),
  alt_text: z.string().optional().default(""),
  hashtags: z.array(z.string()).default([]),
  confidence_notes: z.string().optional().default(""),
});

const parsed = aiDraftSchema.parse(JSON.parse(text));
```

## Drafting Strategy

For WhatsApp intake:

1. Insert submission as `received`.
2. Upload media.
3. If `auto_draft = true`, update status to `drafting`.
4. Call Gemini route or helper.
5. Update status to `pending_review` if successful.
6. Update status to `failed` and `ai_error` if Gemini fails.

For reviewer regeneration:

1. Reviewer enters extra instructions.
2. Route fetches submission, style examples, and settings.
3. Gemini writes a replacement draft.
4. Portal keeps `final_caption` editable independently from `draft_caption`.

## Guardrails

- Do not auto-publish AI text without human approval.
- Make every generated caption editable.
- Ask Gemini to identify missing facts in `confidence_notes`.
- Keep the prompt explicit: "do not invent names, scores, dates, sponsors."
- Store model name and errors for debugging.
- Log style example count so weak drafts can be traced to missing examples.

## Future Improvement

Once the prototype works, add embeddings:

- Store an embedding for each `style_examples.post_text`.
- Store tags for examples.
- Select examples by semantic similarity to the submitted brief.
- Keep a hard cap on prompt length to control costs and latency.

