import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import AudioPlayer from "@/components/AudioPlayer";
import LiveStatus from "@/components/LiveStatus";

export const dynamic = "force-dynamic";

export default async function PodcastDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const podcast = await prisma.podcast.findUnique({
    where: { id: params.id },
    include: { sources: true, job: true },
  });

  if (!podcast) notFound();

  return (
    <div>
      <Link href="/library" className="btn-ghost mb-6">
        ← Biblioteca
      </Link>

      <h1 className="text-2xl font-bold">{podcast.title}</h1>
      <p className="mt-2 text-slate-400">{podcast.topic}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-800 px-2 py-0.5">{podcast.format}</span>
        <span className="rounded bg-slate-800 px-2 py-0.5">{podcast.length}</span>
        <span className="rounded bg-slate-800 px-2 py-0.5 uppercase">
          {podcast.language}
        </span>
        <span className="rounded bg-slate-800 px-2 py-0.5">
          🎧 {podcast.plays} reproducciones
        </span>
      </div>

      <div className="mt-6">
        {podcast.status === "PUBLISHED" && podcast.audioPath ? (
          <AudioPlayer src={podcast.audioPath} podcastId={podcast.id} />
        ) : podcast.status === "FAILED" ? (
          <div className="card">
            <p className="font-semibold text-red-300">❌ Falló la generación</p>
            <p className="mt-2 text-sm text-slate-400">{podcast.errorMsg}</p>
          </div>
        ) : podcast.job ? (
          <LiveStatus jobId={podcast.job.id} />
        ) : (
          <div className="card text-slate-400">Sin información de estado.</div>
        )}
      </div>

      {podcast.sources.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-slate-300">Fuentes</h2>
          <ul className="space-y-1 text-sm text-slate-400">
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
