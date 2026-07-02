"use client";

import { useRef } from "react";

export default function AudioPlayer({
  src,
  podcastId,
}: {
  src: string;
  podcastId: string;
}) {
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
        Tu navegador no soporta el elemento de audio.
      </audio>
      <a href={src} download className="btn-ghost mt-4">
        ⬇️ Descargar MP3
      </a>
    </div>
  );
}
