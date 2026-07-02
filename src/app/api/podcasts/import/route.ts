import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const VALID_FORMATS = ["deep-dive", "brief", "critique", "debate"];
const VALID_LENGTHS = ["short", "default", "long"];

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Validate notebookId
  const notebookId = (body.notebookId ?? "").toString().trim();
  if (!notebookId) {
    return NextResponse.json(
      { error: "notebookId is required" },
      { status: 400 }
    );
  }

  // Import mode: "existing" (use existing audio) or "generate" (generate new)
  const importMode = body.importMode === "existing" ? "existing" : "generate";

  // Audio ID (only used when importMode is "existing")
  const audioId = importMode === "existing"
    ? (body.audioId ?? "").toString().trim()
    : null;

  // Validate format, length, language (only used when importMode is "generate")
  const format = VALID_FORMATS.includes(body.format) ? body.format : "deep-dive";
  const length = VALID_LENGTHS.includes(body.length) ? body.length : "default";
  const language = (body.language ?? "es").toString().slice(0, 10);

  try {
    // Use provided title and topic from the frontend (notebook list already has this info)
    // The frontend passes notebook title and description when importing
    const title =
      (body.title ?? "").toString().trim() ||
      `Imported Notebook ${notebookId.slice(0, 8)}`;

    const topic =
      (body.topic ?? "").toString().trim() ||
      title;

    // Create podcast and job atomically
    const podcast = await prisma.podcast.create({
      data: {
        notebookId,
        audioId,
        title,
        topic,
        format,
        length,
        language,
        status: "PENDING",
        // No sources array - sources are already in NotebookLM
        job: {
          create: { status: "QUEUED", stage: "created", progress: 0 },
        },
      },
      include: { job: true },
    });

    return NextResponse.json({
      podcastId: podcast.id,
      jobId: podcast.job?.id,
      status: podcast.status,
    });
  } catch (error: any) {
    console.error("Error importing notebook:", error);
    return NextResponse.json(
      { error: error.message || "Failed to import notebook" },
      { status: 500 }
    );
  }
}
