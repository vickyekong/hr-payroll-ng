import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth, handleApiError, AuthError } from "@/lib/api-auth";

export async function GET() {
  try {
    const session = await requireAuth();

    if (!session.user.employeeId) {
      throw new AuthError("Employee account required", 403);
    }

    const payslips = await prisma.payslip.findMany({
      where: {
        employeeId: session.user.employeeId,
        payrollRun: {
          companyId: session.user.companyId,
          status: { in: ["APPROVED", "PAID"] },
        },
      },
      include: {
        payrollRun: {
          select: { periodMonth: true, periodYear: true, status: true },
        },
      },
      orderBy: [
        { payrollRun: { periodYear: "desc" } },
        { payrollRun: { periodMonth: "desc" } },
      ],
    });

    return NextResponse.json(
      payslips.map((p) => ({
        ...p,
        grossPayKobo: p.grossPayKobo.toString(),
        netPayKobo: p.netPayKobo.toString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}
