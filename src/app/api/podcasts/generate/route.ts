import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_FORMATS = ["deep-dive", "brief", "critique", "debate"];
const VALID_LENGTHS = ["short", "default", "long"];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const topic = (body.topic ?? "").toString().trim();
  if (topic.length < 10 || topic.length > 500) {
    return NextResponse.json(
      { error: "El tema debe tener entre 10 y 500 caracteres." },
      { status: 400 }
    );
  }

  const format = VALID_FORMATS.includes(body.format) ? body.format : "deep-dive";
  const length = VALID_LENGTHS.includes(body.length) ? body.length : "default";
  const language = (body.language ?? "es").toString().slice(0, 10);

  // URLs opcionales (hasta 10)
  const rawUrls: string[] = Array.isArray(body.urls) ? body.urls : [];
  const urls = rawUrls
    .map((u) => u?.toString().trim())
    .filter((u) => /^https?:\/\//i.test(u))
    .slice(0, 10);

  const title =
    (body.title ?? "").toString().trim() ||
    topic.slice(0, 80) + (topic.length > 80 ? "…" : "");

  const podcast = await prisma.podcast.create({
    data: {
      title,
      topic,
      format,
      length,
      language,
      status: "PENDING",
      sources: {
        create: urls.map((u) => ({ kind: "url", value: u })),
      },
      job: {
        create: { status: "QUEUED", stage: "queued", progress: 0 },
      },
    },
    include: { job: true },
  });

  return NextResponse.json({
    podcastId: podcast.id,
    jobId: podcast.job?.id,
    status: podcast.status,
  });
}
