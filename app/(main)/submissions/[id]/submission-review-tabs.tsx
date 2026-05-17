"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  approveSubmission,
  improveCaption,
  saveCaption
} from "@/app/actions/submissions";
import type { MediaFraming, Submission } from "@/lib/types";
import { PhotoFramingReview } from "./photo-framing-review";

type TabKey = "submitted" | "photos" | "caption" | "publish";
type MediaItem = {
  url: string;
  path: string | null;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "submitted", label: "Step 1 - Review submission" },
  { key: "photos", label: "Step 2 - Crop / zoom photos" },
  { key: "caption", label: "Step 3 - Review caption text" },
  { key: "publish", label: "Step 4 - Approve and publish" }
];

export function SubmissionReviewTabs({
  submission,
  mediaUrls,
  mediaPaths,
  initialFraming
}: {
  submission: Submission;
  mediaUrls: string[];
  mediaPaths: string[];
  initialFraming: MediaFraming | null;
}) {
  const initialMediaItems = useMemo<MediaItem[]>(
    () =>
      mediaUrls.map((url, index) => ({
        url,
        path: mediaPaths[index] ?? null
      })),
    [mediaPaths, mediaUrls]
  );
  const [activeTab, setActiveTab] = useState<TabKey>("submitted");
  const [mediaItems, setMediaItems] = useState(initialMediaItems);
  const [hasSavedFraming, setHasSavedFraming] = useState(Boolean(initialFraming));
  const [finalCaption, setFinalCaption] = useState(
    submission.final_caption ?? submission.draft_caption ?? submission.brief
  );
  const finalPreview = finalCaption.trim() || submission.brief;
  const finalMediaUrls = useMemo(() => {
    if (!hasSavedFraming) return mediaItems.map((item) => item.url);
    return mediaItems.map((_, index) => `/api/media/framed/${submission.id}/${index}.jpg`);
  }, [hasSavedFraming, mediaItems, submission.id]);

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
          {mediaItems.length > 0 ? (
            <div className="media-grid compact">
              {mediaItems.map((item, index) => (
                <div className="media-frame" key={item.url}>
                  <Image
                    src={item.url}
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
          {mediaItems.length > 0 ? (
            <PhotoFramingReview
              submissionId={submission.id}
              mediaItems={mediaItems}
              initialFraming={initialFraming}
              onMediaItemsChange={setMediaItems}
              onFramingSaved={() => setHasSavedFraming(true)}
            />
          ) : (
            <p className="muted">No photos available to crop.</p>
          )}
        </section>
      ) : null}

      {activeTab === "caption" ? (
        <section className="card review-panel">
          <h2>Step 3 - Review caption text</h2>
          <p className="muted">
            Start with the original WhatsApp text, optionally improve it with AI, then edit the final caption.
          </p>
          <label>
            Original WhatsApp text (not editable)
            <textarea value={submission.brief} readOnly />
          </label>
          <form className="grid">
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
                formAction={improveCaption}
                className="secondary"
              >
                Improve with AI
              </button>
              <button formAction={saveCaption}>Save final caption</button>
            </div>
          </form>
          {submission.ai_error ? (
            <p className="notice">AI drafting error: {submission.ai_error}</p>
          ) : null}
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
    </div>
  );
}
