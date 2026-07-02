import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/podcasts/:id/retry -> reencola el podcast para volver a generarlo.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const podcast = await prisma.podcast.findUnique({
    where: { id: params.id },
    include: { job: true },
  });
  if (!podcast) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Reinicia el estado del podcast y del job para que el worker lo retome.
  await prisma.podcast.update({
    where: { id: podcast.id },
    data: {
      status: "PENDING",
      errorMsg: null,
      notebookId: null,
      audioPath: null,
    },
  });

  if (podcast.job) {
    await prisma.generationJob.update({
      where: { id: podcast.job.id },
      data: {
        status: "QUEUED",
        stage: "queued",
        progress: 0,
        errorMsg: null,
      },
    });
  } else {
    await prisma.generationJob.create({
      data: {
        podcastId: podcast.id,
        status: "QUEUED",
        stage: "queued",
        progress: 0,
      },
    });
  }

  const updated = await prisma.generationJob.findUnique({
    where: { podcastId: podcast.id },
  });
  return NextResponse.json({ ok: true, jobId: updated?.id });
}
