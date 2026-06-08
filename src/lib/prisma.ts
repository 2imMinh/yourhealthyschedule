// src/lib/prisma.ts
// Singleton PrismaClient. In dev, Next.js hot-reload re-imports modules on
// every change, which would otherwise open a new DB connection each time and
// exhaust the pool. Caching the client on globalThis prevents that.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
