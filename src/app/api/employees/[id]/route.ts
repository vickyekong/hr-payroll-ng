import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError, AuthError } from "@/lib/api-auth";
import { nairaToKobo } from "@/lib/money";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import {
  isOmittedOrPlaceholderName,
  isPlaceholderLabel,
} from "@/lib/employees/data-quality";
import { startLifecycle } from "@/lib/lifecycle/service";
import { isShiftAttendanceExempt } from "@/lib/attendance/penalty-exempt";
import { isEmploymentEnded } from "@/lib/employees/status";
import { ensureEmployeeStatusSchema } from "@/lib/ensure-employee-status-schema";
import { ensureJobDescriptionName } from "@/lib/org/ensure-org-structure";
import { can } from "@/lib/permissions";
import { z } from "zod";

const realName = (label: string) =>
  z
    .string()
    .min(1)
    .refine((v) => !isOmittedOrPlaceholderName(v), {
      message: `${label} cannot be blank or a placeholder (N/A, Unknown, Test, …)`,
    });

const realLabel = (label: string) =>
  z
    .string()
    .min(1)
    .refine((v) => !isPlaceholderLabel(v), {
      message: `${label} cannot be blank or a placeholder`,
    });

const updateSchema = z.object({
  firstName: realName("First name").optional(),
  lastName: realName("Last name").optional(),
  department: z.string().trim().max(120).optional(),
  jobTitle: realLabel("Job description").optional(),
  status: z
    .enum(["ACTIVE", "SUSPENDED", "ON_LEAVE", "SICK_LEAVE", "FIRED", "RESIGNED"])
    .optional(),
  sex: z.enum(["MALE", "FEMALE"]).nullable().optional(),
  employmentType: z.enum(["FULL_TIME", "CONTRACT"]).optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  tin: z.string().optional(),
  rsaPin: z.string().optional(),
  nhfNumber: z.string().optional(),
  basicSalary: z.number().positive().optional(),
  housingAllowance: z.number().min(0).optional(),
  transportAllowance: z.number().min(0).optional(),
  otherTaxableAllowances: z.number().min(0).optional(),
  nonTaxableReimbursements: z.number().min(0).optional(),
  annualRent: z.number().min(0).optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  clockDeviceId: z.string().nullable().optional(),
  shiftId: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureEmployeeStatusSchema();
    const employee = await prisma.employee.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
      include: {
        leaveBalances: true,
        documents: true,
        shiftAssignment: { include: { shift: true } },
      },
    });
    if (!employee) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(serializeBigInts(employee));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePermission("manageEmployees");
    await ensureEmployeeStatusSchema();
    const body = updateSchema.parse(await req.json());

    const compensationFields = [
      body.basicSalary,
      body.housingAllowance,
      body.transportAllowance,
      body.otherTaxableAllowances,
      body.nonTaxableReimbursements,
      body.annualRent,
    ];
    if (
      compensationFields.some((v) => v !== undefined) &&
      !can(session.user.role, "manageCompensation")
    ) {
      throw new AuthError("Forbidden: compensation edits require manageCompensation", 403);
    }

    const existing = await prisma.employee.findFirst({
      where: { id: params.id, companyId: session.user.companyId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const employee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        ...(body.firstName && { firstName: body.firstName }),
        ...(body.lastName && { lastName: body.lastName }),
        ...(body.department !== undefined && { department: body.department }),
        ...(body.jobTitle && { jobTitle: body.jobTitle }),
        ...(body.status && { status: body.status }),
        ...(body.sex !== undefined && { sex: body.sex }),
        ...(body.employmentType && { employmentType: body.employmentType }),
        ...(body.bankName !== undefined && { bankName: body.bankName }),
        ...(body.bankAccountNumber !== undefined && { bankAccountNumber: body.bankAccountNumber }),
        ...(body.tin !== undefined && { tin: body.tin }),
        ...(body.rsaPin !== undefined && { rsaPin: body.rsaPin }),
        ...(body.nhfNumber !== undefined && { nhfNumber: body.nhfNumber }),
        ...(body.basicSalary !== undefined && { basicSalaryKobo: nairaToKobo(body.basicSalary) }),
        ...(body.housingAllowance !== undefined && { housingAllowanceKobo: nairaToKobo(body.housingAllowance) }),
        ...(body.transportAllowance !== undefined && { transportAllowanceKobo: nairaToKobo(body.transportAllowance) }),
        ...(body.otherTaxableAllowances !== undefined && { otherTaxableAllowancesKobo: nairaToKobo(body.otherTaxableAllowances) }),
        ...(body.nonTaxableReimbursements !== undefined && { nonTaxableReimbursementsKobo: nairaToKobo(body.nonTaxableReimbursements) }),
        ...(body.annualRent !== undefined && { annualRentKobo: nairaToKobo(body.annualRent) }),
        ...(body.nextOfKinName !== undefined && { nextOfKinName: body.nextOfKinName }),
        ...(body.nextOfKinPhone !== undefined && { nextOfKinPhone: body.nextOfKinPhone }),
        ...(body.clockDeviceId !== undefined && {
          clockDeviceId: body.clockDeviceId?.trim() || null,
        }),
      },
    });

    if (body.jobTitle?.trim()) {
      await ensureJobDescriptionName(session.user.companyId, body.jobTitle).catch(
        () => null
      );
    }

    const effectiveDepartment = body.department ?? existing.department;
    const shiftExempt = isShiftAttendanceExempt(effectiveDepartment);

    if (shiftExempt) {
      await prisma.employeeShiftAssignment.deleteMany({
        where: { employeeId: params.id },
      });
    } else if (body.shiftId !== undefined) {
      if (body.shiftId) {
        const shift = await prisma.shiftTemplate.findFirst({
          where: { id: body.shiftId, companyId: session.user.companyId },
        });
        if (!shift) {
          return NextResponse.json({ error: "Shift not found" }, { status: 404 });
        }
        await prisma.employeeShiftAssignment.upsert({
          where: { employeeId: params.id },
          create: { employeeId: params.id, shiftId: body.shiftId },
          update: { shiftId: body.shiftId },
        });
      } else {
        await prisma.employeeShiftAssignment.deleteMany({
          where: { employeeId: params.id },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "UPDATE",
        entityType: "Employee",
        entityId: employee.id,
        performedById: session.user.id,
        changes: body,
      },
    });

    if (
      body.status &&
      isEmploymentEnded(body.status) &&
      !isEmploymentEnded(existing.status)
    ) {
      await startLifecycle({
        companyId: session.user.companyId,
        employeeId: employee.id,
        kind: "OFFBOARDING",
      });
    }

    return NextResponse.json(serializeBigInts(employee));
  } catch (error) {
    return handleApiError(error);
  }
}
