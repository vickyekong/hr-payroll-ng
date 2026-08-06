import { prisma } from "@/lib/db";
import {
  DEFAULT_DEPARTMENTS,
  matchDefaultDepartment,
} from "@/lib/org/default-departments";

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
  // FK may already exist
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
 * One-time-ish org cleanup per company:
 * - Move old job-title-as-department catalog into JobDescription
 * - Seed the real department list
 * - Point employees’ jobTitle at former designations; clear non-dept department values
 */
export async function ensureOrgStructure(companyId: string) {
  await ensureJobDescriptionTable();

  const [departments, employees] = await Promise.all([
    prisma.department.findMany({
      where: { companyId },
      select: { id: true, name: true },
    }),
    prisma.employee.findMany({
      where: { companyId },
      select: { id: true, department: true, jobTitle: true },
    }),
  ]);

  const jobNames = new Set<string>();
  for (const d of departments) {
    if (!matchDefaultDepartment(d.name)) {
      jobNames.add(d.name.trim());
    }
  }
  for (const e of employees) {
    if (e.jobTitle?.trim()) jobNames.add(e.jobTitle.trim());
    // Former imports stored designation on department
    if (e.department?.trim() && !matchDefaultDepartment(e.department)) {
      jobNames.add(e.department.trim());
    }
  }

  for (const name of jobNames) {
    if (!name) continue;
    await prisma.jobDescription.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name },
    });
  }

  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { companyId_name: { companyId, name } },
      update: {},
      create: { companyId, name },
    });
  }

  // Fix employee fields: designation → jobTitle, real dept only if matched
  for (const e of employees) {
    const matchedDept = matchDefaultDepartment(e.department);
    const nextJob =
      e.jobTitle?.trim() ||
      (!matchedDept ? e.department.trim() : "") ||
      e.jobTitle;
    const nextDept = matchedDept ?? "";

    if (nextJob !== e.jobTitle || nextDept !== e.department) {
      await prisma.employee.update({
        where: { id: e.id },
        data: {
          jobTitle: nextJob || e.jobTitle || "Staff",
          department: nextDept,
        },
      });
    }
  }

  // Drop leftover non-canonical department rows (employees no longer reference them)
  const stale = departments.filter((d) => !matchDefaultDepartment(d.name));
  for (const d of stale) {
    const stillUsed = await prisma.employee.count({
      where: { companyId, department: d.name },
    });
    if (stillUsed === 0) {
      await prisma.department.delete({ where: { id: d.id } }).catch(() => null);
    }
  }
}
