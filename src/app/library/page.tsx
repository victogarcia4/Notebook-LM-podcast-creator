import { prisma } from "@/lib/db";
import PodcastCard from "@/components/PodcastCard";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const podcasts = await prisma.podcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Biblioteca</h1>
        <span className="text-sm text-slate-500">
          {podcasts.length} podcast{podcasts.length === 1 ? "" : "s"}
        </span>
      </div>

      {podcasts.length === 0 ? (
        <div className="card text-center text-slate-400">
          Todavía no hay podcasts. ¡Crea el primero!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {podcasts.map((p) => (
            <PodcastCard
              key={p.id}
              podcast={{
                id: p.id,
                title: p.title,
                topic: p.topic,
                format: p.format,
                language: p.language,
                status: p.status,
                plays: p.plays,
                createdAt: p.createdAt,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
