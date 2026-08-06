import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `DO $$ BEGIN CREATE TYPE "LifecycleKind" AS ENUM ('ONBOARDING', 'OFFBOARDING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "LifecycleStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "LifecycleTaskStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "ChangeRequestType" AS ENUM ('BANK', 'TAX_RELIEF', 'NEXT_OF_KIN', 'ADDRESS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "ChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS "EmployeeLifecycle" (
    "id" TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "kind" "LifecycleKind" NOT NULL,
    "status" "LifecycleStatus" NOT NULL DEFAULT 'OPEN',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS "EmployeeLifecycle_companyId_status_kind_idx" ON "EmployeeLifecycle"("companyId", "status", "kind")`,
  `CREATE INDEX IF NOT EXISTS "EmployeeLifecycle_employeeId_kind_status_idx" ON "EmployeeLifecycle"("employeeId", "kind", "status")`,
  `CREATE TABLE IF NOT EXISTS "EmployeeLifecycleTask" (
    "id" TEXT PRIMARY KEY,
    "lifecycleId" TEXT NOT NULL REFERENCES "EmployeeLifecycle"("id") ON DELETE CASCADE,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "href" TEXT,
    "status" "LifecycleTaskStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeLifecycleTask_lifecycleId_key_key" ON "EmployeeLifecycleTask"("lifecycleId", "key")`,
  `CREATE INDEX IF NOT EXISTS "EmployeeLifecycleTask_lifecycleId_status_idx" ON "EmployeeLifecycleTask"("lifecycleId", "status")`,
  `CREATE TABLE IF NOT EXISTS "EmployeeChangeRequest" (
    "id" TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "employeeId" TEXT NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "type" "ChangeRequestType" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "note" TEXT,
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "EmployeeChangeRequest_companyId_status_createdAt_idx" ON "EmployeeChangeRequest"("companyId", "status", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "EmployeeChangeRequest_employeeId_status_idx" ON "EmployeeChangeRequest"("employeeId", "status")`,
];

async function main() {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  console.log("Phase 3 schema applied");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
