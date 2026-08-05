import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requirePermission, handleApiError } from "@/lib/api-auth";
import { mapStatutoryConfig } from "@/lib/payroll/config-mapper";
import {
  combineBaselineWithScenario,
  forecastHireScenario,
} from "@/lib/forecasting/payroll-scenario";

const schema = z.object({
  headcount: z.number().int().min(1).max(500),
  basicNaira: z.number().positive().max(100_000_000),
  housingNaira: z.number().min(0).max(100_000_000).optional(),
  transportNaira: z.number().min(0).max(100_000_000).optional(),
  otherAllowancesNaira: z.number().min(0).max(100_000_000).optional(),
  label: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("viewReports");
    const body = schema.parse(await req.json());

    const company = await prisma.company.findUnique({
      where: { id: session.user.companyId },
      include: { statutoryConfig: true, taxBands: true },
    });
    const config = mapStatutoryConfig(
      company?.statutoryConfig ?? null,
      company?.taxBands
    );

    const scenario = forecastHireScenario(config, body);

    const latest = await prisma.payrollRun.findFirst({
      where: {
        companyId: session.user.companyId,
        status: { in: ["APPROVED", "PAID"] },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: {
        payslips: {
          select: {
            grossPayKobo: true,
            netPayKobo: true,
            pensionEmployerKobo: true,
            nsitfKobo: true,
          },
        },
      },
    });

    let baseline = null;
    if (latest && latest.payslips.length > 0) {
      const totals = latest.payslips.reduce(
        (acc, p) => ({
          gross: acc.gross + p.grossPayKobo,
          net: acc.net + p.netPayKobo,
          employer:
            acc.employer +
            p.grossPayKobo +
            p.pensionEmployerKobo +
            p.nsitfKobo,
        }),
        { gross: 0n, net: 0n, employer: 0n }
      );
      baseline = {
        headcount: latest.payslips.length,
        monthlyGrossKobo: totals.gross.toString(),
        monthlyNetKobo: totals.net.toString(),
        monthlyEmployerCostKobo: totals.employer.toString(),
        period: {
          month: latest.periodMonth,
          year: latest.periodYear,
        },
      };
    }

    const projected = combineBaselineWithScenario(
      baseline
        ? {
            headcount: baseline.headcount,
            monthlyGrossKobo: baseline.monthlyGrossKobo,
            monthlyNetKobo: baseline.monthlyNetKobo,
            monthlyEmployerCostKobo: baseline.monthlyEmployerCostKobo,
          }
        : null,
      scenario
    );

    return NextResponse.json({ scenario, baseline, projected });
  } catch (error) {
    return handleApiError(error);
  }
}
