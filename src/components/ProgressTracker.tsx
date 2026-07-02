"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { JobStatus } from "@/hooks/useSSE";

const STAGES = [
  "queued",
  "created",
  "research",
  "generating",
  "downloading",
  "done",
];

export default function ProgressTracker({ status }: { status: JobStatus }) {
  const { t } = useI18n();
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const currentIndex = STAGES.findIndex((s) => s === status.stage);
  const failed = status.status === "FAILED" || !!status.error;
  const done = status.status === "DONE";

  return (
    <div className="card mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-xl">
          {done
            ? t("progress.done")
            : failed
            ? t("progress.failed")
            : t("progress.generating")}
        </h3>
        <span className="font-mono text-sm text-dim">{status.progress}%</span>
      </div>

      <div className="mb-5 h-1.5 w-full overflow-hidden bg-white/10">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.max(5, status.progress)}%`,
            background: failed ? "var(--accent)" : "var(--accent)",
          }}
        />
      </div>

      <ol className="space-y-2.5">
        {STAGES.map((s, i) => {
          const active = i === currentIndex && !done && !failed;
          const complete = done || i < currentIndex;
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center font-mono text-xs ${
                  complete
                    ? "bg-accent text-black"
                    : active
                    ? "bg-fg text-black"
                    : "bg-white/10 text-mute"
                }`}
              >
                {complete ? "✓" : active ? "•" : i + 1}
              </span>
              <span className={active ? "text-fg" : "text-dim"}>
                {t(`stage.${s}`)}
              </span>
            </li>
          );
        })}
      </ol>

      {failed && (
        <>
          <p className="mt-4 border border-accent/40 bg-accent/10 p-3 text-sm text-accent">
            {status.errorMsg || status.error || "Error"}
          </p>
          <button
            onClick={async () => {
              setRetrying(true);
              await fetch(`/api/podcasts/${status.podcastId}/retry`, {
                method: "POST",
              });
              router.push(`/podcast/${status.podcastId}`);
            }}
            disabled={retrying}
            className="btn-primary mt-4"
          >
            ↻ {retrying ? t("action.retrying") : t("action.retry")}
          </button>
        </>
      )}

      {done && (
        <Link href={`/podcast/${status.podcastId}`} className="btn-primary mt-5">
          {t("progress.listen")}
        </Link>
      )}
    </div>
  );
}
