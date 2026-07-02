import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "@/lib/db";

// GET /api/podcasts/:id  -> detalle
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const podcast = await prisma.podcast.findUnique({
    where: { id: params.id },
    include: { sources: true, job: true },
  });
  if (!podcast) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ podcast });
}

// POST /api/podcasts/:id  -> incrementa el contador de reproducciones
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const podcast = await prisma.podcast
    .update({
      where: { id: params.id },
      data: { plays: { increment: 1 } },
    })
    .catch(() => null);
  if (!podcast) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  return NextResponse.json({ plays: podcast.plays });
}

// DELETE /api/podcasts/:id  -> borra el podcast, sus relaciones y su MP3
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const podcast = await prisma.podcast.findUnique({ where: { id: params.id } });
  if (!podcast) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Borra el archivo de audio si existe (audioPath es del tipo /audio/<id>.mp3).
  if (podcast.audioPath) {
    const rel = podcast.audioPath.replace(/^\//, "");
    const abs = path.join(process.cwd(), "public", rel);
    await fs.unlink(abs).catch(() => {});
  }

  // onDelete: Cascade en el schema borra sources y job.
  await prisma.podcast.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
