import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../lib/db";
import { uploadAudioFile } from "../lib/storage";
import { reportWorkerStatus } from "../lib/worker-status";
import {
  authCheck,
  authStatus,
  createNotebook,
  addUrlSource,
  addResearch,
  cleanSources,
  waitSourcesReady,
  generateAudio,
  downloadAudio,
  checkAudioStatus,
} from "../lib/notebooklm/client";
import { translateTitleBoth } from "../lib/translate";

/** Reintenta una operación async con backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseMs = 4000, label = "op" } = {}
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      log(`⚠ ${label} falló (intento ${i}/${attempts}): ${(err as Error).message}`);
      if (i < attempts) await sleep(baseMs * i);
    }
  }
  throw lastErr;
}

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 5000);
const AUDIO_DIR = process.env.AUDIO_DIR ?? "public/audio";
const PROJECT_ROOT = process.cwd();
let lastStatusReportAt = 0;

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

  // Traduce el título a EN/ES para las tarjetas (no bloquea el flujo si falla).
  if (!podcast.titleEn || !podcast.titleEs) {
    try {
      const { titleEn, titleEs } = await translateTitleBoth(podcast.title);
      await prisma.podcast.update({
        where: { id: podcast.id },
        data: { titleEn, titleEs },
      });
    } catch {
      /* la traducción es opcional */
    }
  }

  // 0. Verificar autenticación
  const authed = await authCheck();
  if (!authed) {
    throw new Error(
      "Sesión de NotebookLM expirada. Vuelve a autenticarte con el flujo de login de la skill NotebookLMSkill."
    );
  }

  // SMART RESUME: Verificar si ya existe notebook y audio
  let notebookId = podcast.notebookId;
  let audioReady = false;

  if (notebookId) {
    log(`✓ Notebook ya existe: ${notebookId}`);
    // Verificar si el audio ya está listo
    const audioStatus = await checkAudioStatus(notebookId);
    if (audioStatus.ready) {
      log(`✓ Audio ya está listo, saltando a descarga...`);
      audioReady = true;
      await updateJob(job.id, { stage: "downloading", progress: 90 });
    } else {
      log(`⚠ Audio no está listo (status: ${audioStatus.status}), regenerando...`);
      await updateJob(job.id, { stage: "generating", progress: 60 });
    }
  } else {
    // 1. Crear notebook (solo si no existe)
    log(`Creando nuevo notebook...`);
    notebookId = await createNotebook(`Podcast: ${podcast.topic}`);
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
        await withRetry(() => addUrlSource(notebookId!, s.value), {
          label: `source add ${s.value}`,
        });
      }
    } else {
      log(`Investigando en la web sobre: ${podcast.topic}`);
      await withRetry(() => addResearch(notebookId!, podcast.topic), {
        attempts: 3,
        baseMs: 8000,
        label: "add-research",
      });
    }
    await updateJob(job.id, { stage: "research", progress: 45 });

    // 3. Limpiar fuentes con errores/duplicadas antes de generar
    log("Limpiando fuentes con errores o duplicadas...");
    await cleanSources(notebookId!);

    // 4. Esperar a que las fuentes estén listas
    await waitSourcesReady(notebookId!);
    await updateJob(job.id, { stage: "generating", progress: 60 });
  }

  // 5. Generar audio (solo si no está listo)
  if (!audioReady) {
    log(`Generando audio (formato=${podcast.format}, duración=${podcast.length})...`);
    await generateAudio(notebookId!, {
      format: podcast.format,
      length: podcast.length,
      language: podcast.language,
      instructions: `Crea un podcast atractivo y bien estructurado sobre: ${podcast.topic}`,
      retry: 2,
    });
    await updateJob(job.id, { stage: "downloading", progress: 90 });
  }

  // 5. Descargar el MP3
  const audioDirAbs = path.join(PROJECT_ROOT, AUDIO_DIR);
  await fs.mkdir(audioDirAbs, { recursive: true });
  const fileName = `${podcast.id}.mp3`;
  const outPath = path.join(audioDirAbs, fileName);

  // Si se especificó un audioId, descargar ese audio específico
  // Si no, descargar el más reciente
  if (podcast.audioId) {
    log(`Descargando audio específico (${podcast.audioId}) a ${outPath}`);
    await downloadAudio(notebookId!, outPath, podcast.audioId);
  } else {
    log(`Descargando audio más reciente a ${outPath}`);
    await downloadAudio(notebookId!, outPath);
  }

  // Ruta publica: local (/audio/...) o URL remota si STORAGE_DRIVER=s3.
  const publicPath = await uploadAudioFile(outPath, fileName);

  // 6. Publicar
  await prisma.podcast.update({
    where: { id: podcast.id },
    data: { status: "PUBLISHED", audioPath: publicPath },
  });
  await updateJob(job.id, { status: "DONE", stage: "done", progress: 100 });
  log(`✅ Podcast publicado: ${publicPath}`);
}

async function tick() {
  await refreshWorkerStatus();

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
  await refreshWorkerStatus({ force: true });
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

async function refreshWorkerStatus({ force = false } = {}) {
  if (!force && Date.now() - lastStatusReportAt < 60_000) return;
  lastStatusReportAt = Date.now();

  try {
    log("🔍 Verificando estado de autenticación de NotebookLM...");
    const status = await authStatus();
    log(`✓ Auth status: ${status.valid ? "VÁLIDO" : "INVÁLIDO"}`);

    await reportWorkerStatus({
      status: "ONLINE",
      authValid: status.valid,
      message: status.valid
        ? "Worker Windows conectado y autenticado."
        : "Worker Windows conectado, pero NotebookLM no esta autenticado.",
    });

    log(`✓ WorkerStatus actualizado en BD: authValid=${status.valid}`);
  } catch (err: any) {
    log(`❌ Error verificando auth status: ${err?.message}`);

    try {
      await reportWorkerStatus({
        status: "ONLINE",
        authValid: false,
        message: err?.message ?? "No se pudo verificar NotebookLM.",
      });
      log("✓ WorkerStatus actualizado con error");
    } catch (dbErr: any) {
      log(`❌ Error actualizando BD: ${dbErr?.message}`);
    }
  }
}

main().catch((err) => {
  console.error("Worker fatal:", err);
  process.exit(1);
});
