"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import PodcastCard, { PodcastSummary } from "@/components/PodcastCard";

export default function LibraryPage() {
  const { t } = useI18n();
  const [podcasts, setPodcasts] = useState<PodcastSummary[] | null>(null);

  const load = () => {
    fetch("/api/podcasts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPodcasts(d.podcasts ?? []))
      .catch(() => setPodcasts([]));
  };

  useEffect(() => {
    load();
  }, []);

  const count = podcasts?.length ?? 0;

  return (
    <div>
      <div className="mb-8 flex items-end justify-between border-b border-line pb-4">
        <h1 className="font-display text-4xl">{t("library.title")}</h1>
        {podcasts && (
          <span className="font-mono text-xs uppercase tracking-widest text-dim">
            {count} {count === 1 ? t("library.one") : t("library.many")}
          </span>
        )}
      </div>

      {podcasts === null ? (
        <div className="card text-dim">{t("detail.loading")}</div>
      ) : count === 0 ? (
        <div className="card text-dim">{t("library.empty")}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {podcasts.map((p) => (
            <PodcastCard key={p.id} podcast={p} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
