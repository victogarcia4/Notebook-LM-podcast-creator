import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/podcasts?status=PUBLISHED&q=texto
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const q = searchParams.get("q")?.trim();

  const podcasts = await prisma.podcast.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? { OR: [{ title: { contains: q } }, { topic: { contains: q } }] }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { job: true },
  });

  return NextResponse.json({ podcasts });
}
