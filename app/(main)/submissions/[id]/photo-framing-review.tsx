"use client";

import Image from "next/image";
import { useState } from "react";

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

export function PhotoFramingReview({ mediaUrls }: { mediaUrls: string[] }) {
  const [settingsByUrl, setSettingsByUrl] = useState<Record<string, FrameSettings>>({});

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

  return (
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
  );
}
