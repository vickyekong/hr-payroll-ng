import bcrypt from "bcryptjs";
import type { Company, User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_NTA2025_TAX_BANDS } from "@/lib/payroll/paye";
import { ensurePayrollHardeningSchema } from "@/lib/ensure-payroll-hardening-schema";

const DEFAULT_DEPARTMENTS = ["Management", "HR", "Finance", "Operations"];

export class TenancyError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

export type BootstrapCompanyInput = {
  companyName: string;
  address?: string | null;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

export type BootstrapCompanyResult = {
  company: Pick<Company, "id" | "name">;
  admin: Pick<User, "id" | "email" | "name" | "role" | "companyId">;
};

/** Create a tenant with NTA 2025 statutory defaults + Super Admin. */
export async function bootstrapCompany(
  input: BootstrapCompanyInput
): Promise<BootstrapCompanyResult> {
  const companyName = input.companyName.trim();
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();
  const address = input.address?.trim() || null;

  if (companyName.length < 2) {
    throw new TenancyError("Company name must be at least 2 characters");
  }
  if (adminName.length < 2) {
    throw new TenancyError("Admin name must be at least 2 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new TenancyError("Enter a valid admin email");
  }
  if (input.adminPassword.length < 8) {
    throw new TenancyError("Password must be at least 8 characters");
  }

  await ensurePayrollHardeningSchema();

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (existing) {
    throw new TenancyError(
      "That email is already registered. Sign in or use a different email.",
      409
    );
  }

  const passwordHash = await bcrypt.hash(input.adminPassword, 12);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        address,
      },
      select: { id: true, name: true },
    });

    await tx.statutoryConfig.create({
      data: {
        companyId: company.id,
        taxReliefMode: "NTA2025",
      },
    });

    await tx.taxBand.createMany({
      data: DEFAULT_NTA2025_TAX_BANDS.map((band, i) => ({
        companyId: company.id,
        lowerBoundKobo: band.lowerBoundKobo,
        upperBoundKobo: band.upperBoundKobo,
        rateBps: band.rateBps,
        sortOrder: i,
      })),
    });

    await tx.department.createMany({
      data: DEFAULT_DEPARTMENTS.map((name) => ({
        companyId: company.id,
        name,
      })),
      skipDuplicates: true,
    });

    const admin = await tx.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        role: "SUPER_ADMIN",
        passwordHash,
        companyId: company.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        companyId: true,
      },
    });

    return { company, admin };
  });

  try {
    await prisma.attendanceSettings.create({
      data: { companyId: result.company.id },
    });
  } catch {
    // Optional — attendance routes upsert settings on first use.
  }

  return result;
}

export type InviteTeamUserInput = {
  companyId: string;
  name: string;
  email: string;
  password: string;
  role: Extract<UserRole, "HR_ADMIN" | "SUPER_ADMIN">;
};

/** Invite Super Admin or HR into an existing company (same-tenant only). */
export async function inviteTeamUser(input: InviteTeamUserInput) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  if (name.length < 2) {
    throw new TenancyError("Name must be at least 2 characters");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new TenancyError("Enter a valid email");
  }
  if (input.password.length < 8) {
    throw new TenancyError("Password must be at least 8 characters");
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, companyId: true },
  });
  if (existing) {
    throw new TenancyError(
      existing.companyId === input.companyId
        ? "That user is already on your team."
        : "That email is already registered to another company.",
      409
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      email,
      name,
      role: input.role,
      passwordHash,
      companyId: input.companyId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      companyId: true,
    },
  });
}
