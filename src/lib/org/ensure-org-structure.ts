import { prisma } from "@/lib/db";
import { DEFAULT_DEPARTMENTS } from "@/lib/org/default-departments";

let tableEnsured = false;
/** Skip heavy seed work on warm serverless instances after first success per company. */
const orgEnsuredForCompany = new Set<string>();

export async function ensureJobDescriptionTable() {
  if (tableEnsured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "JobDescription" (
      "id" TEXT NOT NULL,
      "companyId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "JobDescription_companyId_name_key"
    ON "JobDescription"("companyId", "name")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "JobDescription_companyId_idx"
    ON "JobDescription"("companyId")
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "JobDescription"
      ADD CONSTRAINT "JobDescription_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  } catch {
    // constraint already present
  }
  tableEnsured = true;
}

/**
 * Fast, additive seed. Safe to call on page load — caches per company in-process
 * and only inserts missing default departments (no per-employee job-title upserts).
 */
export async function ensureOrgStructure(companyId: string) {
  if (orgEnsuredForCompany.has(companyId)) return;

  await ensureJobDescriptionTable();

  const existing = await prisma.department.findMany({
    where: { companyId },
    select: { name: true },
  });
  const have = new Set(existing.map((d) => d.name));
  const missing = DEFAULT_DEPARTMENTS.filter((name) => !have.has(name));

  if (missing.length > 0) {
    await prisma.department.createMany({
      data: missing.map((name) => ({ companyId, name })),
      skipDuplicates: true,
    });
  }

  orgEnsuredForCompany.add(companyId);
}

/** Call when a job title is assigned so the catalog stays in sync without page-load work. */
export async function ensureJobDescriptionName(
  companyId: string,
  name: string
) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await ensureJobDescriptionTable();
  await prisma.jobDescription.upsert({
    where: { companyId_name: { companyId, name: trimmed } },
    update: {},
    create: { companyId, name: trimmed },
  });
}
