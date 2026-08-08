import { prisma } from "@/lib/db";

let ensured = false;

/** Idempotent additive columns for Phase 1 payroll hardening. */
export async function ensurePayrollHardeningSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "StatutoryConfig"
    ADD COLUMN IF NOT EXISTS "workingDaysPerMonth" INTEGER NOT NULL DEFAULT 22
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PayrollRun"
    ADD COLUMN IF NOT EXISTS "statutorySnapshot" JSONB
  `);
  ensured = true;
}
