import { PrismaClient } from "@prisma/client";

// Reutiliza la instancia de Prisma en desarrollo para evitar múltiples conexiones
// durante el hot-reload de Next.js.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
