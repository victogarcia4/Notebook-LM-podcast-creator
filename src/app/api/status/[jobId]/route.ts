import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/status/:jobId  -> Server-Sent Events con el progreso del job.
export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const encoder = new TextEncoder();
  const jobId = params.jobId;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        const job = await prisma.generationJob.findUnique({
          where: { id: jobId },
          include: { podcast: true },
        });

        if (!job) {
          send({ error: "Job no encontrado" });
          finish();
          return;
        }

        send({
          jobId: job.id,
          podcastId: job.podcastId,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          errorMsg: job.errorMsg,
          audioPath: job.podcast.audioPath,
          podcastStatus: job.podcast.status,
        });

        if (job.status === "DONE" || job.status === "FAILED") {
          finish();
        }
      };

      const interval = setInterval(() => {
        poll().catch(() => {});
      }, 2000);

      const finish = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      };

      // Primer envío inmediato
      await poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
