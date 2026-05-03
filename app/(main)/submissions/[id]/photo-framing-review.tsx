"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { saveMediaFraming } from "@/app/actions/media-framing";
import type { MediaFraming } from "@/lib/types";

type FrameMode = "contain" | "cover";

type FrameSettings = {
  mode: FrameMode;
  zoom: number;
  x: number;
  y: number;
};

const defaultSettings: FrameSettings = {
  mode: "contain",
  zoom: 1,
  x: 0,
  y: 0
};

export function PhotoFramingReview({
  submissionId,
  mediaUrls,
  initialFraming
}: {
  submissionId: string;
  mediaUrls: string[];
  initialFraming: MediaFraming | null;
}) {
  const [settingsByUrl, setSettingsByUrl] = useState<Record<string, FrameSettings>>(
    () => initialFraming ?? {}
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
      mediaUrls.map((url) => [url, settingsByUrl[url] ?? defaultSettings])
    );

    setMessage(null);
    startTransition(async () => {
      try {
        await saveMediaFraming(submissionId, framing);
        setMessage("Framing saved. Instagram publishing will use this 9:16 crop.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save framing.");
      }
    });
  }

  return (
    <div className="grid">
      <div className="media-grid">
        {mediaUrls.map((url, index) => {
          const settings = settingsByUrl[url] ?? defaultSettings;
          const isContain = settings.mode === "contain";

          return (
            <article className="media-review-card" key={url}>
              <div className="media-frame">
                <Image
                  src={url}
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
                <div className="segmented-control" aria-label={`Photo ${index + 1} frame mode`}>
                  <button
                    className={isContain ? "" : "secondary"}
                    type="button"
                    onClick={() => updateSettings(url, { mode: "contain", zoom: 1, x: 0, y: 0 })}
                  >
                    Fit full photo
                  </button>
                  <button
                    className={!isContain ? "" : "secondary"}
                    type="button"
                    onClick={() => updateSettings(url, { mode: "cover", zoom: 1, x: 0, y: 0 })}
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
                    onChange={(event) => updateSettings(url, { zoom: Number(event.target.value) })}
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
                    onChange={(event) => updateSettings(url, { x: Number(event.target.value) })}
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
                    onChange={(event) => updateSettings(url, { y: Number(event.target.value) })}
                  />
                </label>
                <button className="secondary" type="button" onClick={() => resetSettings(url)}>
                  Reset framing
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" onClick={saveFraming} disabled={isPending}>
          {isPending ? "Saving framing..." : "Save crop / zoom for Instagram"}
        </button>
        {message ? <span className="muted">{message}</span> : null}
      </div>
    </div>
  );
}
