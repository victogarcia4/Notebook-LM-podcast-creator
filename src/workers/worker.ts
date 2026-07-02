import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../lib/db";
import {
  authCheck,
  createNotebook,
  addUrlSource,
  addResearch,
  waitSourcesReady,
  generateAudio,
  downloadAudio,
} from "../lib/notebooklm/client";

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const AUDIO_DIR = process.env.AUDIO_DIR ?? "public/audio";
const PROJECT_ROOT = process.cwd();

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[worker ${ts}] ${msg}`);
}

async function updateJob(
  jobId: string,
  data: { status?: string; stage?: string; progress?: number; errorMsg?: string }
) {
  await prisma.generationJob.update({ where: { id: jobId }, data });
}

async function processJob(job: {
  id: string;
  podcastId: string;
  attempts: number;
}) {
  const podcast = await prisma.podcast.findUnique({
    where: { id: job.podcastId },
    include: { sources: true },
  });
  if (!podcast) {
    await updateJob(job.id, { status: "FAILED", errorMsg: "Podcast no encontrado" });
    return;
  }

  log(`Procesando podcast "${podcast.title}" (${podcast.id})`);
  await updateJob(job.id, {
    status: "RUNNING",
    stage: "created",
    progress: 5,
  });
  await prisma.podcast.update({
    where: { id: podcast.id },
    data: { status: "GENERATING" },
  });

  // 0. Verificar autenticación
  const authed = await authCheck();
  if (!authed) {
    throw new Error(
      "Sesión de NotebookLM expirada. Vuelve a autenticarte con el flujo de login de la skill NotebookLMSkill."
    );
  }

  // 1. Crear notebook
  const notebookId = await createNotebook(`Podcast: ${podcast.topic}`);
  await prisma.podcast.update({
    where: { id: podcast.id },
    data: { notebookId },
  });
  await updateJob(job.id, { stage: "research", progress: 20 });
  log(`Notebook creado: ${notebookId}`);

  // 2. Añadir fuentes
  const urlSources = podcast.sources.filter((s) => s.kind === "url");
  if (urlSources.length > 0) {
    for (const s of urlSources) {
      log(`Añadiendo fuente URL: ${s.value}`);
      await addUrlSource(notebookId, s.value);
    }
  } else {
    log(`Investigando en la web sobre: ${podcast.topic}`);
    await addResearch(notebookId, podcast.topic);
  }
  await updateJob(job.id, { stage: "research", progress: 45 });

  // 3. Esperar a que las fuentes estén listas
  await waitSourcesReady(notebookId);
  await updateJob(job.id, { stage: "generating", progress: 60 });

  // 4. Generar el podcast (bloquea hasta completar)
  log(`Generando audio (formato=${podcast.format}, duración=${podcast.length})...`);
  await generateAudio(notebookId, {
    format: podcast.format,
    length: podcast.length,
    language: podcast.language,
    instructions: `Crea un podcast atractivo y bien estructurado sobre: ${podcast.topic}`,
    retry: 2,
  });
  await updateJob(job.id, { stage: "downloading", progress: 90 });

  // 5. Descargar el MP3
  const audioDirAbs = path.join(PROJECT_ROOT, AUDIO_DIR);
  await fs.mkdir(audioDirAbs, { recursive: true });
  const fileName = `${podcast.id}.mp3`;
  const outPath = path.join(audioDirAbs, fileName);
  log(`Descargando audio a ${outPath}`);
  await downloadAudio(notebookId, outPath);

  // Ruta pública servida por Next desde /public
  const publicPath = `/${AUDIO_DIR.replace(/^public\//, "")}/${fileName}`;

  // 6. Publicar
  await prisma.podcast.update({
    where: { id: podcast.id },
    data: { status: "PUBLISHED", audioPath: publicPath },
  });
  await updateJob(job.id, { status: "DONE", stage: "done", progress: 100 });
  log(`✅ Podcast publicado: ${publicPath}`);
}

async function tick() {
  const job = await prisma.generationJob.findFirst({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return;

  try {
    await prisma.generationJob.update({
      where: { id: job.id },
      data: { attempts: { increment: 1 } },
    });
    await processJob(job);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    log(`❌ Error procesando job ${job.id}: ${msg}`);
    await updateJob(job.id, {
      status: "FAILED",
      stage: "failed",
      errorMsg: msg,
    });
    await prisma.podcast
      .update({
        where: { id: job.podcastId },
        data: { status: "FAILED", errorMsg: msg },
      })
      .catch(() => {});
  }
}

async function main() {
  log(`Worker iniciado. Sondeando cada ${POLL_MS}ms.`);
  log(`CLI: ${process.env.NLM_PATH}`);
  // Bucle de sondeo continuo
  // eslint-disable-next-line no-constant-condition
  while (true) {
    await tick();
    await sleep(POLL_MS);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Worker fatal:", err);
  process.exit(1);
});
