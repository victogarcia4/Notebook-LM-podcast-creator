"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n, pickTitle } from "@/lib/i18n";

export interface PodcastSummary {
  id: string;
  title: string;
  titleEn?: string | null;
  titleEs?: string | null;
  topic: string;
  format: string;
  language: string;
  status: string;
  plays: number;
  createdAt: string | Date;
}

const STATUS_CLS: Record<string, string> = {
  PUBLISHED: "text-accent",
  GENERATING: "text-yellow",
  PENDING: "text-dim",
  FAILED: "text-accent",
};

export default function PodcastCard({
  podcast,
  onChanged,
}: {
  podcast: PodcastSummary;
  onChanged?: () => void;
}) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState<null | "delete" | "retry">(null);
  const cls = STATUS_CLS[podcast.status] ?? "text-dim";
  const title = pickTitle(lang, podcast);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t("action.confirmDelete"))) return;
    setBusy("delete");
    try {
      await fetch(`/api/podcasts/${podcast.id}`, { method: "DELETE" });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy("retry");
    try {
      await fetch(`/api/podcasts/${podcast.id}/retry`, { method: "POST" });
      onChanged?.();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Link
      href={`/podcast/${podcast.id}`}
      className="card block transition-colors hover:border-line-strong"
    >
      <div className="mb-3 flex items-center justify-between font-mono text-xs uppercase tracking-widest">
        <span className={cls}>{t(`status.${podcast.status}`)}</span>
        <span className="text-mute">♪ {podcast.plays}</span>
      </div>
      <h3 className="font-display text-lg leading-tight">{title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-dim">{podcast.topic}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-mute">
        <span className="border border-line px-2 py-0.5">
          {t(`fmt.${podcast.format}`)}
        </span>
        <span className="border border-line px-2 py-0.5">
          {podcast.language}
        </span>
        <span className="flex-1" />
        {podcast.status === "FAILED" && (
          <button
            onClick={handleRetry}
            disabled={busy !== null}
            className="border border-line-strong px-2 py-0.5 uppercase tracking-widest text-fg transition-colors hover:bg-fg hover:text-black disabled:opacity-50"
          >
            ↻ {busy === "retry" ? t("action.retrying") : t("action.retry")}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={busy !== null}
          className="border border-line-strong px-2 py-0.5 uppercase tracking-widest text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          title={t("action.delete")}
        >
          🗑 {busy === "delete" ? t("action.deleting") : t("action.delete")}
        </button>
      </div>
    </Link>
  );
}
