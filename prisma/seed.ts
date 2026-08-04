import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_NTA2025_TAX_BANDS } from "../src/lib/payroll/paye";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.upsert({
    where: { id: "seed-company" },
    update: {},
    create: {
      id: "seed-company",
      name: "Acme Nigeria Ltd",
      address: "12 Victoria Island, Lagos",
    },
  });

  await prisma.statutoryConfig.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      taxReliefMode: "NTA2025",
    },
  });

  for (let i = 0; i < DEFAULT_NTA2025_TAX_BANDS.length; i++) {
    const band = DEFAULT_NTA2025_TAX_BANDS[i];
    await prisma.taxBand.upsert({
      where: { id: `seed-band-${i}` },
      update: {},
      create: {
        id: `seed-band-${i}`,
        companyId: company.id,
        lowerBoundKobo: band.lowerBoundKobo,
        upperBoundKobo: band.upperBoundKobo,
        rateBps: band.rateBps,
        sortOrder: i,
      },
    });
  }

  const passwordHash = await bcrypt.hash("password123", 12);

  const users = [
    { email: "admin@acme.ng", name: "Super Admin", role: "SUPER_ADMIN" as UserRole },
    { email: "hr@acme.ng", name: "HR Admin", role: "HR_ADMIN" as UserRole },
    { email: "finance@acme.ng", name: "Finance Approver", role: "FINANCE" as UserRole },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        companyId: company.id,
      },
    });
  }

  const departmentNames = ["Engineering", "Finance", "HR", "Management"];
  for (const name of departmentNames) {
    await prisma.department.upsert({
      where: {
        companyId_name: { companyId: company.id, name },
      },
      update: {},
      create: { companyId: company.id, name },
    });
  }

  const employees = [
    {
      employeeCode: "EMP-001",
      firstName: "Adaeze",
      lastName: "Okonkwo",
      sex: "FEMALE" as const,
      department: "Engineering",
      jobTitle: "Senior Developer",
      basicSalaryKobo: 50000000n,
      housingAllowanceKobo: 20000000n,
      transportAllowanceKobo: 5000000n,
    },
    {
      employeeCode: "EMP-002",
      firstName: "Chidi",
      lastName: "Eze",
      sex: "MALE" as const,
      department: "Finance",
      jobTitle: "Accountant",
      basicSalaryKobo: 35000000n,
      housingAllowanceKobo: 15000000n,
      transportAllowanceKobo: 3000000n,
    },
    {
      employeeCode: "EMP-003",
      firstName: "Fatima",
      lastName: "Bello",
      sex: "FEMALE" as const,
      department: "HR",
      jobTitle: "HR Officer",
      basicSalaryKobo: 28000000n,
      housingAllowanceKobo: 10000000n,
      transportAllowanceKobo: 2500000n,
    },
  ];

  for (const emp of employees) {
    const employee = await prisma.employee.upsert({
      where: {
        companyId_employeeCode: {
          companyId: company.id,
          employeeCode: emp.employeeCode,
        },
      },
      update: {
        sex: emp.sex,
      },
      create: {
        ...emp,
        companyId: company.id,
        startDate: new Date("2024-01-15"),
        bankName: "GTBank",
        bankAccountNumber: "0123456789",
        tin: "12345678-0001",
        status: "ACTIVE",
        employmentType: "FULL_TIME",
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
        usedDays: 3,
      },
    });
  }

  const adaeze = await prisma.employee.findFirst({
    where: { employeeCode: "EMP-001", companyId: company.id },
  });

  if (adaeze) {
    await prisma.user.upsert({
      where: { email: "adaeze@acme.ng" },
      update: {},
      create: {
        email: "adaeze@acme.ng",
        name: "Adaeze Okonkwo",
        role: "EMPLOYEE",
        passwordHash,
        companyId: company.id,
        employeeId: adaeze.id,
      },
    });
  }

  console.log("Seed completed.");
  console.log("Login: admin@acme.ng / password123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
