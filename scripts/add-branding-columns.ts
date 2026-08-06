/**
 * One-shot: add company branding columns.
 * Usage: npx tsx scripts/add-branding-columns.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const timeout = setTimeout(() => {
    console.error("Timed out waiting for database");
    process.exit(1);
  }, 25_000);

  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandAccentHex" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "brandInkHex" TEXT`
    );
    console.log("Company branding columns ready");
  } finally {
    clearTimeout(timeout);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
