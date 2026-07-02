"use client";

import { useRef } from "react";
import { useI18n } from "@/lib/i18n";

export default function AudioPlayer({
  src,
  podcastId,
}: {
  src: string;
  podcastId: string;
}) {
  const { t } = useI18n();
  const counted = useRef(false);

  function handlePlay() {
    if (counted.current) return;
    counted.current = true;
    fetch(`/api/podcasts/${podcastId}`, { method: "POST" }).catch(() => {});
  }

  return (
    <div className="card">
      <audio
        controls
        className="w-full"
        src={src}
        onPlay={handlePlay}
        preload="metadata"
      >
        <track kind="captions" />
      </audio>
      <a href={src} download className="btn-outline mt-4">
        ↓ {t("detail.download")}
      </a>
    </div>
  );
}
