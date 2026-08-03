import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { nairaToKobo } from "@/lib/money";
import { z } from "zod";

const employeeSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  department: z.string().min(1),
  jobTitle: z.string().min(1),
  employmentType: z.enum(["FULL_TIME", "CONTRACT"]).default("FULL_TIME"),
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
});

export async function GET() {
  try {
    const session = await requirePermission("manageEmployees");
    const employees = await prisma.employee.findMany({
      where: { companyId: session.user.companyId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(employees);
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

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
