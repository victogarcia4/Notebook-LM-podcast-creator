import Link from "next/link";

export interface PodcastSummary {
  id: string;
  title: string;
  topic: string;
  format: string;
  language: string;
  status: string;
  plays: number;
  createdAt: string | Date;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PUBLISHED: { label: "Publicado", cls: "bg-green-900/60 text-green-300" },
  GENERATING: { label: "Generando…", cls: "bg-amber-900/60 text-amber-300" },
  PENDING: { label: "En cola", cls: "bg-slate-800 text-slate-300" },
  FAILED: { label: "Falló", cls: "bg-red-900/60 text-red-300" },
};

export default function PodcastCard({ podcast }: { podcast: PodcastSummary }) {
  const badge = STATUS_BADGE[podcast.status] ?? STATUS_BADGE.PENDING;
  return (
    <Link
      href={`/podcast/${podcast.id}`}
      className="card block transition hover:border-brand-light"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className={`rounded-full px-2.5 py-0.5 text-xs ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-xs text-slate-500">🎧 {podcast.plays}</span>
      </div>
      <h3 className="line-clamp-2 font-semibold">{podcast.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm text-slate-400">{podcast.topic}</p>
      <div className="mt-4 flex gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-800 px-2 py-0.5">{podcast.format}</span>
        <span className="rounded bg-slate-800 px-2 py-0.5 uppercase">
          {podcast.language}
        </span>
      </div>
    </Link>
  );
}
