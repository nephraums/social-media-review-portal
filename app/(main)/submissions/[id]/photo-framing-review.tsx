"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { saveSubmissionMediaOrder } from "@/app/actions/media-assets";
import { saveMediaFraming } from "@/app/actions/media-framing";
import type { MediaFraming } from "@/lib/types";

type FrameMode = "contain" | "cover";

type FrameSettings = {
  mode: FrameMode;
  zoom: number;
  x: number;
  y: number;
};

type MediaItem = {
  url: string;
  path: string | null;
};

const defaultSettings: FrameSettings = {
  mode: "contain",
  zoom: 1,
  x: 0,
  y: 0
};

export function PhotoFramingReview({
  submissionId,
  mediaItems,
  initialFraming,
  showSaveButton = true,
  onMediaItemsChange,
  onFramingSaved
}: {
  submissionId: string;
  mediaItems: MediaItem[];
  initialFraming: MediaFraming | null;
  showSaveButton?: boolean;
  onMediaItemsChange?: (items: MediaItem[]) => void;
  onFramingSaved?: () => void;
}) {
  const [settingsByUrl, setSettingsByUrl] = useState<Record<string, FrameSettings>>(
    () => initialFraming ?? {}
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [draggedUrl, setDraggedUrl] = useState<string | null>(null);

  function updateSettings(url: string, updates: Partial<FrameSettings>) {
    setSettingsByUrl((current) => ({
      ...current,
      [url]: {
        ...(current[url] ?? defaultSettings),
        ...updates
      }
    }));
  }

  function resetSettings(url: string) {
    setSettingsByUrl((current) => ({
      ...current,
      [url]: defaultSettings
    }));
  }

  function saveFraming() {
    const framing = Object.fromEntries(
      mediaItems.map((item) => [item.url, settingsByUrl[item.url] ?? defaultSettings])
    );

    setMessage(null);
    startTransition(async () => {
      try {
        await saveMediaFraming(submissionId, framing);
        onFramingSaved?.();
        setMessage("Framing saved. Instagram publishing will use this 9:16 crop.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save framing.");
      }
    });
  }

  function deletePhoto(url: string) {
    const nextItems = mediaItems.filter((item) => item.url !== url);
    onMediaItemsChange?.(nextItems);
    setSettingsByUrl((current) => {
      const next = { ...current };
      delete next[url];
      return next;
    });
    setMessage("Photo removed from this submission. Save photo changes to persist.");
  }

  function movePhoto(fromUrl: string, toUrl: string) {
    if (fromUrl === toUrl) return;
    const fromIndex = mediaItems.findIndex((item) => item.url === fromUrl);
    const toIndex = mediaItems.findIndex((item) => item.url === toUrl);
    if (fromIndex < 0 || toIndex < 0) return;

    const nextItems = [...mediaItems];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    onMediaItemsChange?.(nextItems);
    setMessage("Photo order changed. Save photo changes to persist.");
  }

  function savePhotoChanges() {
    setMessage(null);
    startTransition(async () => {
      try {
        await saveSubmissionMediaOrder(submissionId, mediaItems);
        setMessage("Photo order and deletions saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save photo changes.");
      }
    });
  }

  return (
    <div className="grid">
      <div className="media-grid">
        {mediaItems.map((item, index) => {
          const settings = settingsByUrl[item.url] ?? defaultSettings;
          const isContain = settings.mode === "contain";

          return (
            <article
              className="media-review-card"
              draggable
              key={item.url}
              onDragStart={() => setDraggedUrl(item.url)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedUrl) {
                  movePhoto(draggedUrl, item.url);
                }
                setDraggedUrl(null);
              }}
            >
              <div className="media-frame">
                <Image
                  src={item.url}
                  alt={`Submitted media ${index + 1}`}
                  fill
                  sizes="(max-width: 820px) 100vw, 480px"
                  unoptimized
                  style={{
                    objectFit: settings.mode,
                    transform: `translate(${settings.x}%, ${settings.y}%) scale(${settings.zoom})`
                  }}
                />
              </div>

              <div className="media-controls">
                <div className="actions">
                  <span className="pill">Photo {index + 1}</span>
                  <button className="danger compact-button" type="button" onClick={() => deletePhoto(item.url)}>
                    Delete photo
                  </button>
                </div>
                <p className="muted">Drag this card onto another photo to reorder.</p>
                <div className="segmented-control" aria-label={`Photo ${index + 1} frame mode`}>
                  <button
                    className={isContain ? "" : "secondary"}
                    type="button"
                    onClick={() => updateSettings(item.url, { mode: "contain", zoom: 1, x: 0, y: 0 })}
                  >
                    Fit full photo
                  </button>
                  <button
                    className={!isContain ? "" : "secondary"}
                    type="button"
                    onClick={() => updateSettings(item.url, { mode: "cover", zoom: 1, x: 0, y: 0 })}
                  >
                    Crop to 9:16
                  </button>
                </div>

                <label>
                  Zoom
                  <input
                    type="range"
                    min="1"
                    max="2.5"
                    step="0.05"
                    value={settings.zoom}
                    onChange={(event) => updateSettings(item.url, { zoom: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Move left/right
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={settings.x}
                    onChange={(event) => updateSettings(item.url, { x: Number(event.target.value) })}
                  />
                </label>
                <label>
                  Move up/down
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={settings.y}
                    onChange={(event) => updateSettings(item.url, { y: Number(event.target.value) })}
                  />
                </label>
                <button className="secondary" type="button" onClick={() => resetSettings(item.url)}>
                  Reset framing
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {showSaveButton ? (
        <div className="actions">
          <button className="secondary" type="button" onClick={savePhotoChanges} disabled={isPending}>
            {isPending ? "Saving photos..." : "Save photo order / deletions"}
          </button>
          <button type="button" onClick={saveFraming} disabled={isPending}>
            {isPending ? "Saving framing..." : "Save crop / zoom for Instagram"}
          </button>
          {message ? <span className="muted">{message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
