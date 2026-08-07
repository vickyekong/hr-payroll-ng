import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { nairaToKobo } from "@/lib/money";
import { ensureJobDescriptionTable } from "@/lib/org/ensure-org-structure";
import { ensureEmployeeStatusSchema } from "@/lib/ensure-employee-status-schema";
import { z } from "zod";
import bundledRoster from "@/data/staff-details-roster.json";

const rowSchema = z.object({
  employeeCode: z.string().min(1).max(40),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(120),
  jobTitle: z.string().min(1).max(120),
  basicSalary: z.number().min(0).optional(),
  housingAllowance: z.number().min(0).optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  isNew: z.boolean().optional(),
});

const leftBehindSchema = z.object({
  employeeCode: z.string().min(1),
});

const bodySchema = z.object({
  useBundledRoster: z.boolean().optional(),
  confirmSync: z.literal(true),
  /** Mark staff missing from the sheet as RESIGNED (default true). */
  resignMissing: z.boolean().optional(),
  staff: z.array(rowSchema).min(1).max(500).optional(),
  leftBehind: z.array(leftBehindSchema).optional(),
  jobTitles: z.array(z.string()).optional(),
});

/**
 * Upsert staff from an updated Excel roster:
 * - Match by employeeCode; update name, job title, bank, pay
 * - Create new codes
 * - Seed JobDescription catalog from designations
 * - Optionally resign people no longer on the sheet
 * Does NOT wipe employees or overwrite department.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureEmployeeStatusSchema();
    await ensureJobDescriptionTable();

    const body = bodySchema.parse(await req.json());
    const companyId = session.user.companyId;

    const rosterStaff = body.useBundledRoster
      ? rowSchema.array().parse(
          (bundledRoster as { staff: unknown }).staff
        )
      : body.staff;

    if (!rosterStaff?.length) {
      return NextResponse.json(
        { error: "No staff rows provided" },
        { status: 400 }
      );
    }

    const leftBehind =
      body.leftBehind ??
      (body.useBundledRoster
        ? ((bundledRoster as { leftBehind?: Array<{ employeeCode: string }> })
            .leftBehind ?? [])
        : []);

    const jobTitles = [
      ...new Set(
        (body.jobTitles ??
          (body.useBundledRoster
            ? ((bundledRoster as { jobTitles?: string[] }).jobTitles ?? [])
            : [])
        )
          .concat(rosterStaff.map((r) => r.jobTitle))
          .map((t) => t.trim())
          .filter(Boolean)
      ),
    ];

    for (const name of jobTitles) {
      await prisma.jobDescription.upsert({
        where: { companyId_name: { companyId, name } },
        update: {},
        create: { companyId, name },
      });
    }

    const year = new Date().getFullYear();
    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);

    let updated = 0;
    let created = 0;
    const createdCodes: string[] = [];
    const updatedCodes: string[] = [];

    for (const row of rosterStaff) {
      const code = row.employeeCode.trim().toUpperCase();
      const existing = await prisma.employee.findFirst({
        where: { companyId, employeeCode: code },
      });

      const pay =
        row.basicSalary !== undefined
          ? {
              basicSalaryKobo: nairaToKobo(row.basicSalary),
              housingAllowanceKobo: nairaToKobo(row.housingAllowance ?? 0),
            }
          : {};

      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: {
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            jobTitle: row.jobTitle.trim(),
            bankName: row.bankName?.trim() || null,
            bankAccountNumber: row.bankAccountNumber?.trim() || null,
            status:
              existing.status === "RESIGNED" || existing.status === "FIRED"
                ? "ACTIVE"
                : existing.status,
            ...pay,
          },
        });
        updated += 1;
        updatedCodes.push(code);
      } else {
        const employee = await prisma.employee.create({
          data: {
            companyId,
            employeeCode: code,
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            department: "Admin",
            jobTitle: row.jobTitle.trim(),
            employmentType: "FULL_TIME",
            status: "ACTIVE",
            startDate,
            bankName: row.bankName?.trim() || null,
            bankAccountNumber: row.bankAccountNumber?.trim() || null,
            basicSalaryKobo: nairaToKobo(row.basicSalary ?? 0),
            housingAllowanceKobo: nairaToKobo(row.housingAllowance ?? 0),
            transportAllowanceKobo: 0n,
            clockDeviceId: null,
          },
        });
        await prisma.leaveBalance.create({
          data: {
            employeeId: employee.id,
            leaveType: "ANNUAL",
            year,
            entitledDays: 21,
            usedDays: 0,
          },
        });
        created += 1;
        createdCodes.push(code);
      }
    }

    let resigned = 0;
    const resignedCodes: string[] = [];
    const resignMissing = body.resignMissing !== false;
    if (resignMissing && leftBehind.length) {
      for (const row of leftBehind) {
        const code = row.employeeCode.trim().toUpperCase();
        const result = await prisma.employee.updateMany({
          where: {
            companyId,
            employeeCode: code,
            status: { notIn: ["RESIGNED", "FIRED"] },
          },
          data: { status: "RESIGNED", endDate: new Date() },
        });
        if (result.count > 0) {
          resigned += result.count;
          resignedCodes.push(code);
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId,
        action: "SYNC_EMPLOYEE_ROSTER",
        entityType: "Employee",
        entityId: companyId,
        performedById: session.user.id,
        changes: {
          updated,
          created,
          resigned,
          jobTitles: jobTitles.length,
          createdCodes: createdCodes.slice(0, 20),
          resignedCodes,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      updated,
      created,
      resigned,
      jobTitles: jobTitles.length,
      createdCodes,
      resignedCodes,
      updatedSample: updatedCodes.slice(0, 5),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
