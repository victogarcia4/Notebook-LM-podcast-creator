import { NextRequest, NextResponse } from "next/server";
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
