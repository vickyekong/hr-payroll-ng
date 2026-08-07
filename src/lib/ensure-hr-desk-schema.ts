import { prisma } from "@/lib/db";

let ensured = false;

/** Idempotent: TRIAGED status + assigneeUserId column for HR Desk workflows. */
export async function ensureHrDeskSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "HrDeskStatus" ADD VALUE IF NOT EXISTS 'TRIAGED'`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "HrDeskMessage" ADD COLUMN IF NOT EXISTS "assigneeUserId" TEXT`
  );
  ensured = true;
}
