import "dotenv/config";
import { prisma } from "./src/lib/db";
import { reportWorkerStatus } from "./src/lib/worker-status";
import { authStatus } from "./src/lib/notebooklm/client";

async function main() {
  console.log("Verificando autenticación de NotebookLM...");
  const status = await authStatus();
  console.log("Auth status:", status);

  console.log("\nActualizando WorkerStatus en la base de datos...");
  await reportWorkerStatus({
    status: "ONLINE",
    authValid: status.valid,
    message: status.valid
      ? "Worker Windows conectado y autenticado."
      : "Worker Windows conectado, pero NotebookLM no esta autenticado.",
  });

  console.log("\n✅ WorkerStatus actualizado exitosamente!");

  const current = await prisma.workerStatus.findUnique({
    where: { id: "default" },
  });
  console.log("\nEstado actual:", current);

  await prisma.$disconnect();
}

main().catch(console.error);
