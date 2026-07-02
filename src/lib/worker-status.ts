import { prisma } from "./db";

export const WORKER_STATUS_ID = "default";

export async function reportWorkerStatus(data: {
  status: string;
  authValid?: boolean | null;
  message?: string | null;
}) {
  await prisma.workerStatus.upsert({
    where: { id: WORKER_STATUS_ID },
    create: {
      id: WORKER_STATUS_ID,
      status: data.status,
      authValid: data.authValid,
      message: data.message,
      lastSeenAt: new Date(),
    },
    update: {
      status: data.status,
      authValid: data.authValid,
      message: data.message,
      lastSeenAt: new Date(),
    },
  });
}

export async function readWorkerStatus() {
  const worker = await prisma.workerStatus.findUnique({
    where: { id: WORKER_STATUS_ID },
  });
  if (!worker) {
    return {
      valid: false,
      workerOnline: false,
      message: "Worker no conectado.",
      lastSeenAt: null,
    };
  }

  const ageMs = Date.now() - worker.lastSeenAt.getTime();
  const workerOnline = ageMs < 2 * 60 * 1000;

  return {
    valid: workerOnline && worker.authValid === true,
    workerOnline,
    workerStatus: worker.status,
    message: worker.message,
    lastSeenAt: worker.lastSeenAt.toISOString(),
  };
}
