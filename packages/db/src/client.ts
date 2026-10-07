import { PrismaClient } from "@prisma/client";
import { poolSize, withPoolLimit } from "./pool-url.js";

// Single shared PrismaClient. In dev, reuse across HMR reloads to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // A capped pool per process — see pool-url.ts. Without it six services filled Postgres.
    ...(process.env.DATABASE_URL ? { datasources: { db: { url: withPoolLimit(process.env.DATABASE_URL, poolSize())! } } } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
