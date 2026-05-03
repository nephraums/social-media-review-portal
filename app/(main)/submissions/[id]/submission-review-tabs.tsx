"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  approveSubmission,
  regenerateDraft,
  rejectSubmission,
  saveCaption
} from "@/app/actions/submissions";
import type { MediaFraming, Submission } from "@/lib/types";
import { PhotoFramingReview } from "./photo-framing-review";

type TabKey = "submitted" | "photos" | "caption" | "publish";

const tabs: { key: TabKey; label: string }[] = [
  { key: "submitted", label: "Step 1 - Review submission" },
  { key: "photos", label: "Step 2 - Crop / zoom photos" },
  { key: "caption", label: "Step 3 - Review caption text" },
  { key: "publish", label: "Step 4 - Approve and publish" }
];

export function SubmissionReviewTabs({
  submission,
  mediaUrls,
  initialFraming
}: {
  submission: Submission;
  mediaUrls: string[];
  initialFraming: MediaFraming | null;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("submitted");
  const [userCaption, setUserCaption] = useState(submission.brief);
  const [finalCaption, setFinalCaption] = useState(
    submission.final_caption ?? submission.draft_caption ?? submission.brief
  );
  const aiCaption = submission.draft_caption ?? "";
  const finalPreview = finalCaption.trim() || aiCaption.trim() || userCaption.trim();
  const finalMediaUrls = useMemo(() => {
    if (!initialFraming) return mediaUrls;
    return mediaUrls.map((_, index) => `/api/media/framed/${submission.id}/${index}`);
  }, [initialFraming, mediaUrls, submission.id]);

  return (
    <div className="review-layout">
      <nav className="review-tabs" aria-label="Submission review steps">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.key ? "" : "secondary"}
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "submitted" ? (
        <section className="card review-panel">
          <p className="pill">{submission.status}</p>
          <h2>Step 1 - Review submission</h2>
          <p className="muted">This is what was originally submitted from WhatsApp.</p>
          <dl className="details-list">
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(submission.created_at).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Submitter</dt>
              <dd>{submission.whatsapp_from ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Original text</dt>
              <dd>{submission.brief}</dd>
            </div>
          </dl>
          {mediaUrls.length > 0 ? (
            <div className="media-grid compact">
              {mediaUrls.map((url, index) => (
                <div className="media-frame" key={url}>
                  <Image
                    src={url}
                    alt={`Original submitted media ${index + 1}`}
                    fill
                    sizes="(max-width: 820px) 100vw, 360px"
                    unoptimized
                    style={{ objectFit: "contain" }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No photos were attached.</p>
          )}
        </section>
      ) : null}

      {activeTab === "photos" ? (
        <section className="card review-panel">
          <h2>Step 2 - Crop / zoom fit photos</h2>
          <p className="muted">
            Adjust the 9:16 crop so the saved version is what Instagram publishing uses.
          </p>
          {mediaUrls.length > 0 ? (
            <PhotoFramingReview
              submissionId={submission.id}
              mediaUrls={mediaUrls}
              initialFraming={initialFraming}
            />
          ) : (
            <p className="muted">No photos available to crop.</p>
          )}
        </section>
      ) : null}

      {activeTab === "caption" ? (
        <section className="card review-panel">
          <h2>Step 3 - Review caption text</h2>
          <div className="grid two">
            <div className="grid">
              <label>
                Original WhatsApp text (not editable)
                <textarea value={submission.brief} readOnly />
              </label>
              <label>
                Edited user-generated text
                <textarea
                  value={userCaption}
                  onChange={(event) => {
                    setUserCaption(event.target.value);
                    if (!aiCaption) {
                      setFinalCaption(event.target.value);
                    }
                  }}
                />
              </label>
            </div>
            <div className="grid">
              <form action={regenerateDraft} className="grid">
                <input type="hidden" name="id" value={submission.id} />
                <input type="hidden" name="reviewer_notes" value={userCaption} />
                <label>
                  AI enhanced text
                  <textarea
                    defaultValue={aiCaption}
                    placeholder="Click the button below to generate AI enhanced text."
                    readOnly
                  />
                </label>
                <button type="submit" className="secondary">
                  Generate / regenerate AI text
                </button>
              </form>
              {submission.ai_error ? (
                <p className="notice">AI drafting error: {submission.ai_error}</p>
              ) : null}
            </div>
          </div>

          <form action={saveCaption} className="grid" style={{ marginTop: "1rem" }}>
            <input type="hidden" name="id" value={submission.id} />
            <label>
              Final caption
              <textarea
                name="final_caption"
                value={finalCaption}
                onChange={(event) => setFinalCaption(event.target.value)}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setFinalCaption(aiCaption || userCaption)}
              >
                Use best available text
              </button>
              <button type="submit">Save final caption</button>
            </div>
          </form>
        </section>
      ) : null}

      {activeTab === "publish" ? (
        <section className="card review-panel">
          <h2>Step 4 - Approve and publish</h2>
          <p className="muted">
            Final check. This queues the Instagram publish job with the saved 9:16 crop and final caption.
          </p>
          {finalMediaUrls.length > 0 ? (
            <div className="media-grid compact">
              {finalMediaUrls.map((url, index) => (
                <div className="media-frame" key={`${url}-${index}`}>
                  <Image
                    src={url}
                    alt={`Final publish media ${index + 1}`}
                    fill
                    sizes="(max-width: 820px) 100vw, 360px"
                    unoptimized
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No final photo available.</p>
          )}

          <div className="card">
            <h3>Final caption</h3>
            <p>{finalPreview || "No caption saved yet."}</p>
          </div>

          <form action={approveSubmission} className="grid">
            <input type="hidden" name="id" value={submission.id} />
            <input type="hidden" name="final_caption" value={finalPreview} />
            <button type="submit">Approve and publish</button>
          </form>
        </section>
      ) : null}

      <section className="card review-panel">
        <h2>Reject submission</h2>
        <form action={rejectSubmission} className="grid">
          <input type="hidden" name="id" value={submission.id} />
          <textarea name="reason" placeholder="Reason sent back over WhatsApp" required />
          <button type="submit" className="danger">
            Reject and reply
          </button>
        </form>
      </section>
    </div>
  );
}
