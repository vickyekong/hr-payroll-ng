import { prisma } from "@/lib/db";

let ensured = false;

/** Idempotent: add branding columns if missing (pooler-safe IF NOT EXISTS). */
export async function ensureCompanyBrandingSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandAccentHex" TEXT`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandInkHex" TEXT`
  );
  ensured = true;
}
