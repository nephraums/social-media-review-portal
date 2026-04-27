export type SubmissionStatus =
  | "received"
  | "drafting"
  | "pending_review"
  | "approved"
  | "rejected"
  | "publishing"
  | "published"
  | "failed";

export type PublishJobStatus = "queued" | "running" | "succeeded" | "failed";

export type Submission = {
  id: string;
  organisation_id: string;
  submitter_id: string | null;
  whatsapp_from: string | null;
  source: string;
  brief: string;
  status: SubmissionStatus;
  media_urls: string[] | null;
  media_paths: string[] | null;
  draft_caption: string | null;
  final_caption: string | null;
  ai_model: string | null;
  ai_error: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  instagram_media_id: string | null;
  instagram_permalink: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionEvent = {
  id: string;
  organisation_id: string;
  submission_id: string;
  actor_user_id: string | null;
  actor_label: string | null;
  event_type: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type PublishJob = {
  id: string;
  organisation_id: string;
  submission_id: string;
  status: PublishJobStatus;
  platform: string;
  attempt_count: number;
  last_error: string | null;
  external_container_id: string | null;
  external_media_id: string | null;
  external_permalink: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type StyleExample = {
  id: string;
  organisation_id: string;
  label: string | null;
  post_text: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AiSettings = {
  organisation_id: string;
  brand_voice_notes: string | null;
  default_hashtags: string | null;
  banned_phrases: string | null;
  call_to_action_notes: string | null;
  auto_draft: boolean;
  gemini_model: string;
  updated_at: string;
};

export type InstagramConnection = {
  organisation_id: string;
  instagram_user_id: string;
  instagram_username: string | null;
  facebook_page_id: string | null;
  access_token: string;
  token_expires_at: string | null;
  connected_by: string | null;
  connected_at: string;
  updated_at: string;
};
