/**
 * Import unique staff from a clock Time Card PDF export into Employees.
 *
 * Usage:
 *   npx tsx scripts/import-timecard-staff.ts
 *
 * Expects scripts/timecard-staff.json (clockDeviceId, firstName, department).
 * PDF only includes a single name field — stored as firstName; lastName mirrors
 * it until HR edits full legal names. Salary left at ₦0 for HR to complete.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type StaffRow = {
  clockDeviceId: string;
  firstName: string;
  department: string;
};

async function main() {
  const file = path.join(__dirname, "timecard-staff.json");
  const rows = JSON.parse(readFileSync(file, "utf8")) as StaffRow[];

  const company = await prisma.company.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!company) {
    throw new Error("No company found. Seed or create a company first.");
  }

  const deptNames = [...new Set(rows.map((r) => r.department))];
  for (const name of deptNames) {
    await prisma.department.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { companyId: company.id, name },
    });
  }

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const employeeCode = row.clockDeviceId;
    const firstName = row.firstName.trim();
    // Clock export has one name only — mirror until HR fills legal surname.
    const lastName = firstName;
    const department = row.department.trim();
    const jobTitle = department;

    const existing = await prisma.employee.findUnique({
      where: {
        companyId_employeeCode: {
          companyId: company.id,
          employeeCode,
        },
      },
    });

    if (existing) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          department,
          jobTitle,
          clockDeviceId: row.clockDeviceId,
          status: "ACTIVE",
        },
      });
      updated += 1;
    } else {
      const employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          employeeCode,
          firstName,
          lastName,
          department,
          jobTitle,
          employmentType: "FULL_TIME",
          status: "ACTIVE",
          startDate: new Date("2026-07-01"),
          clockDeviceId: row.clockDeviceId,
          basicSalaryKobo: 0n,
          housingAllowanceKobo: 0n,
          transportAllowanceKobo: 0n,
        },
      });

      await prisma.leaveBalance.upsert({
        where: {
          employeeId_leaveType_year: {
            employeeId: employee.id,
            leaveType: "ANNUAL",
            year: 2026,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          leaveType: "ANNUAL",
          year: 2026,
          entitledDays: 21,
          usedDays: 0,
        },
      });
      created += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        companyId: company.id,
        companyName: company.name,
        department: deptNames,
        total: rows.length,
        created,
        updated,
      },
      null,
      2
    )
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
