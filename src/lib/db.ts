import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Serverless (Vercel) + Supabase often land on connection_limit=1.
 * Parallel Promise.all fans on /dashboard then starve the pool (P2024).
 * Bump pool timeout and allow a small limit when not using PgBouncer.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    const usingPooler =
      url.port === "6543" ||
      url.searchParams.get("pgbouncer") === "true" ||
      url.hostname.includes("pooler");

    if (!url.searchParams.has("connection_limit")) {
      // PgBouncer transaction mode: keep Prisma at 1; otherwise allow a few.
      url.searchParams.set("connection_limit", usingPooler ? "1" : "5");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "30");
    }
    if (usingPooler && !url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient() {
  const url = datasourceUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse across warm serverless invocations (and local HMR).
globalForPrisma.prisma = prisma;
