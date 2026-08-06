import { prisma } from "@/lib/db";

let ensured = false;

/** Idempotent: ensure RESIGNED exists on EmployeeStatus enum. */
export async function ensureEmployeeStatusSchema() {
  if (ensured) return;
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "EmployeeStatus" ADD VALUE IF NOT EXISTS 'RESIGNED'`
  );
  ensured = true;
}
