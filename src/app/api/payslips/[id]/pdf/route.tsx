import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/db";
import { requireAuth, handleApiError, AuthError } from "@/lib/api-auth";
import { PayslipDocument } from "@/lib/payslip-pdf";
import { getMonthName } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();

    const payslip = await prisma.payslip.findUnique({
      where: { id: params.id },
      include: {
        employee: true,
        payrollRun: { include: { company: true } },
      },
    });

    if (!payslip || payslip.payrollRun.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (
      session.user.role === "EMPLOYEE" &&
      payslip.employeeId !== session.user.employeeId
    ) {
      throw new AuthError("Forbidden", 403);
    }

    if (!["APPROVED", "PAID"].includes(payslip.payrollRun.status)) {
      return NextResponse.json(
        { error: "Payslip available only after payroll approval" },
        { status: 400 }
      );
    }

    const periodLabel = `${getMonthName(payslip.payrollRun.periodMonth)} ${payslip.payrollRun.periodYear}`;

    const buffer = await renderToBuffer(
      <PayslipDocument
        companyName={payslip.payrollRun.company.name}
        companyAddress={payslip.payrollRun.company.address ?? undefined}
        employeeName={`${payslip.employee.firstName} ${payslip.employee.lastName}`}
        employeeCode={payslip.employee.employeeCode}
        department={payslip.employee.department}
        periodLabel={periodLabel}
        bankName={payslip.employee.bankName ?? undefined}
        bankAccount={payslip.employee.bankAccountNumber ?? undefined}
        earnings={{
          basic: payslip.basicSalaryKobo.toString(),
          housing: payslip.housingAllowanceKobo.toString(),
          transport: payslip.transportAllowanceKobo.toString(),
          other: payslip.otherAllowancesKobo.toString(),
          bonus: payslip.bonusesKobo.toString(),
          gross: payslip.grossPayKobo.toString(),
        }}
        deductions={{
          paye: payslip.payeKobo.toString(),
          pension: payslip.pensionEmployeeKobo.toString(),
          nhf: payslip.nhfKobo.toString(),
          other: payslip.otherDeductionsKobo.toString(),
          total: (
            payslip.payeKobo +
            payslip.pensionEmployeeKobo +
            payslip.nhfKobo +
            payslip.otherDeductionsKobo
          ).toString(),
        }}
        netPay={payslip.netPayKobo.toString()}
        ytd={{
          gross: payslip.ytdGrossKobo.toString(),
          paye: payslip.ytdPayeKobo.toString(),
          net: payslip.ytdNetKobo.toString(),
        }}
      />
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="payslip-${payslip.employee.employeeCode}-${periodLabel.replace(" ", "-")}.pdf"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
