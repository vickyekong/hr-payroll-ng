import { prisma } from "@/lib/db";
import { DEFAULT_DEPARTMENTS } from "@/lib/org/default-departments";

let tableEnsured = false;

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
 * Additive only — never overwrite employee assignments or delete custom catalog rows.
 * Seeds canonical departments and mirrors employee job titles into the JobDescription catalog.
 */
export async function ensureOrgStructure(companyId: string) {
  await ensureJobDescriptionTable();

  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name },
    });
  }

  const employees = await prisma.employee.findMany({
    where: { companyId },
    select: { jobTitle: true, department: true },
  });

  const jobNames = new Set<string>();
  for (const e of employees) {
    if (e.jobTitle?.trim()) jobNames.add(e.jobTitle.trim());
  }

  for (const name of jobNames) {
    await prisma.jobDescription.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name },
    });
  }
}
