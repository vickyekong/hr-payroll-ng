import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { nairaToKobo } from "@/lib/money";
import { serializeBigInts } from "@/lib/payroll/config-mapper";
import {
  isOmittedOrPlaceholderName,
  isPlaceholderLabel,
} from "@/lib/employees/data-quality";
import { startLifecycle } from "@/lib/lifecycle/service";
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

const employeeSchema = z.object({
  employeeCode: realLabel("Employee code"),
  firstName: realName("First name"),
  lastName: realName("Last name"),
  department: realLabel("Department"),
  jobTitle: realLabel("Job title"),
  employmentType: z.enum(["FULL_TIME", "CONTRACT"]).default("FULL_TIME"),
  status: z
    .enum(["ACTIVE", "SUSPENDED", "ON_LEAVE", "SICK_LEAVE", "FIRED"])
    .default("ACTIVE"),
  sex: z.enum(["MALE", "FEMALE"]),
  startDate: z.string(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  tin: z.string().optional(),
  rsaPin: z.string().optional(),
  nhfNumber: z.string().optional(),
  basicSalary: z.number().positive(),
  housingAllowance: z.number().min(0).default(0),
  transportAllowance: z.number().min(0).default(0),
  otherTaxableAllowances: z.number().min(0).default(0),
  nonTaxableReimbursements: z.number().min(0).default(0),
  annualRent: z.number().min(0).default(0),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  clockDeviceId: z.string().optional(),
});

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const employees = await prisma.employee.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(serializeBigInts(employees));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("manageEmployees");
    const body = employeeSchema.parse(await req.json());

    const employee = await prisma.employee.create({
      data: {
        companyId: session.user.companyId,
        employeeCode: body.employeeCode,
        firstName: body.firstName,
        lastName: body.lastName,
        department: body.department,
        jobTitle: body.jobTitle,
        employmentType: body.employmentType,
        status: body.status,
        sex: body.sex,
        startDate: new Date(body.startDate),
        bankName: body.bankName,
        bankAccountNumber: body.bankAccountNumber,
        tin: body.tin,
        rsaPin: body.rsaPin,
        nhfNumber: body.nhfNumber,
        basicSalaryKobo: nairaToKobo(body.basicSalary),
        housingAllowanceKobo: nairaToKobo(body.housingAllowance),
        transportAllowanceKobo: nairaToKobo(body.transportAllowance),
        otherTaxableAllowancesKobo: nairaToKobo(body.otherTaxableAllowances),
        nonTaxableReimbursementsKobo: nairaToKobo(body.nonTaxableReimbursements),
        annualRentKobo: nairaToKobo(body.annualRent),
        nextOfKinName: body.nextOfKinName,
        nextOfKinPhone: body.nextOfKinPhone,
        clockDeviceId: body.clockDeviceId?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        companyId: session.user.companyId,
        action: "CREATE",
        entityType: "Employee",
        entityId: employee.id,
        performedById: session.user.id,
        changes: { employeeCode: body.employeeCode },
      },
    });

    if (body.status !== "FIRED") {
      await startLifecycle({
        companyId: session.user.companyId,
        employeeId: employee.id,
        kind: "ONBOARDING",
      });
    }

    return NextResponse.json(serializeBigInts(employee), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
