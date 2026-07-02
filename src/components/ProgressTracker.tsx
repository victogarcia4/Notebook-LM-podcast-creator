"use client";

import Link from "next/link";
import { JobStatus } from "@/hooks/useSSE";

const STAGES: { key: string; label: string }[] = [
  { key: "queued", label: "En cola" },
  { key: "created", label: "Notebook creado" },
  { key: "research", label: "Investigando fuentes" },
  { key: "generating", label: "Generando audio" },
  { key: "downloading", label: "Descargando" },
  { key: "done", label: "Publicado" },
];

export default function ProgressTracker({ status }: { status: JobStatus }) {
  const currentIndex = STAGES.findIndex((s) => s.key === status.stage);
  const failed = status.status === "FAILED" || !!status.error;
  const done = status.status === "DONE";

  return (
    <div className="card mt-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">
          {done
            ? "🎉 ¡Podcast listo!"
            : failed
            ? "❌ Falló la generación"
            : "⏳ Generando tu podcast…"}
        </h3>
        <span className="text-sm text-slate-400">{status.progress}%</span>
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            failed ? "bg-red-500" : "bg-brand-light"
          }`}
          style={{ width: `${Math.max(5, status.progress)}%` }}
        />
      </div>

      <ol className="space-y-2">
        {STAGES.map((s, i) => {
          const active = i === currentIndex && !done && !failed;
          const complete = done || i < currentIndex;
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  complete
                    ? "bg-brand text-white"
                    : active
                    ? "bg-brand-light text-white"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {complete ? "✓" : active ? "…" : i + 1}
              </span>
              <span className={active ? "text-slate-100" : "text-slate-400"}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {failed && (
        <p className="mt-4 rounded-lg bg-red-950/50 p-3 text-sm text-red-300">
          {status.errorMsg || status.error || "Error desconocido."}
        </p>
      )}

      {done && (
        <Link href={`/podcast/${status.podcastId}`} className="btn-primary mt-5">
          Escuchar podcast →
        </Link>
      )}
    </div>
  );
}
