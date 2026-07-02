"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, pickTitle } from "@/lib/i18n";
import AudioPlayer from "@/components/AudioPlayer";
import LiveStatus from "@/components/LiveStatus";

interface PodcastDetail {
  id: string;
  title: string;
  titleEn?: string | null;
  titleEs?: string | null;
  topic: string;
  format: string;
  length: string;
  language: string;
  status: string;
  audioPath?: string | null;
  errorMsg?: string | null;
  plays: number;
  sources: { id: string; value: string }[];
  job?: { id: string } | null;
}

export default function PodcastDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [podcast, setPodcast] = useState<PodcastDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<null | "delete" | "retry">(null);

  const load = useCallback(() => {
    fetch(`/api/podcasts/${params.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setPodcast(d.podcast))
      .catch(() => setNotFound(true));
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRetry() {
    setBusy("retry");
    try {
      await fetch(`/api/podcasts/${params.id}/retry`, { method: "POST" });
      load();
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!window.confirm(t("action.confirmDelete"))) return;
    setBusy("delete");
    try {
      await fetch(`/api/podcasts/${params.id}`, { method: "DELETE" });
      router.push("/library");
    } finally {
      setBusy(null);
    }
  }

  if (notFound)
    return <div className="card text-dim">{t("detail.notFound")}</div>;
  if (!podcast) return <div className="card text-dim">{t("detail.loading")}</div>;

  const title = pickTitle(lang, podcast);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/library" className="btn-outline">
          ← {t("detail.back")}
        </Link>
        <div className="flex items-center gap-2">
          {podcast.status === "FAILED" && (
            <button
              onClick={handleRetry}
              disabled={busy !== null}
              className="btn-outline"
            >
              ↻ {busy === "retry" ? t("action.retrying") : t("action.retry")}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 border border-line-strong px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
          >
            🗑 {busy === "delete" ? t("action.deleting") : t("action.delete")}
          </button>
        </div>
      </div>

      <h1 className="font-display text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-3 text-dim">{podcast.topic}</p>
      <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-wider text-mute">
        <span className="border border-line px-2 py-0.5">
          {t(`fmt.${podcast.format}`)}
        </span>
        <span className="border border-line px-2 py-0.5">{podcast.length}</span>
        <span className="border border-line px-2 py-0.5">
          {podcast.language}
        </span>
        <span className="border border-line px-2 py-0.5">
          ♪ {podcast.plays} {t("detail.plays")}
        </span>
      </div>

      <div className="mt-6">
        {podcast.status === "PUBLISHED" && podcast.audioPath ? (
          <AudioPlayer src={podcast.audioPath} podcastId={podcast.id} />
        ) : podcast.status === "FAILED" ? (
          <div className="card">
            <p className="font-display text-lg text-accent">
              {t("detail.failed")}
            </p>
            <p className="mt-2 text-sm text-dim">{podcast.errorMsg}</p>
          </div>
        ) : podcast.job ? (
          <LiveStatus jobId={podcast.job.id} />
        ) : (
          <div className="card text-dim">{t("detail.noStatus")}</div>
        )}
      </div>

      {podcast.sources.length > 0 && (
        <div className="mt-8">
          <h2 className="label">{t("detail.sources")}</h2>
          <ul className="space-y-1 text-sm text-dim">
            {podcast.sources.map((s) => (
              <li key={s.id} className="truncate">
                • {s.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
