import { differenceInMonths } from "date-fns";
import { prisma } from "@/lib/db";
import { employeeSexLabel } from "@/lib/employees/status";
import { formatCurrency } from "@/lib/utils";

export interface EquityGroupRow {
  key: string;
  label: string;
  headcount: number;
  meanGrossKobo: string;
  medianGrossKobo: string;
  meanBasicKobo: string;
  medianBasicKobo: string;
}

export interface EquityGapFlag {
  id: string;
  severity: "watch" | "info";
  title: string;
  detail: string;
  gapPct: number;
  href?: string;
}

export interface TenurePayRow {
  bucket: string;
  headcount: number;
  meanGrossKobo: string;
  meanBasicKobo: string;
}

function median(sorted: bigint[]): bigint {
  if (sorted.length === 0) return 0n;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2n;
  }
  return sorted[mid];
}

function mean(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  return values.reduce((a, b) => a + b, 0n) / BigInt(values.length);
}

function groupStats(
  rows: Array<{ key: string; label: string; gross: bigint; basic: bigint }>
): EquityGroupRow[] {
  const map = new Map<
    string,
    { label: string; gross: bigint[]; basic: bigint[] }
  >();
  for (const r of rows) {
    const g = map.get(r.key) ?? { label: r.label, gross: [], basic: [] };
    g.gross.push(r.gross);
    g.basic.push(r.basic);
    map.set(r.key, g);
  }

  return Array.from(map.entries())
    .map(([key, g]) => {
      const grossSorted = [...g.gross].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const basicSorted = [...g.basic].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      return {
        key,
        label: g.label,
        headcount: g.gross.length,
        meanGrossKobo: mean(g.gross).toString(),
        medianGrossKobo: median(grossSorted).toString(),
        meanBasicKobo: mean(g.basic).toString(),
        medianBasicKobo: median(basicSorted).toString(),
      };
    })
    .sort((a, b) => b.headcount - a.headcount);
}

function gapPct(a: bigint, b: bigint): number | null {
  const base = a < b ? a : b;
  const high = a < b ? b : a;
  if (base <= 0n) return null;
  return Math.round(Number(((high - base) * 100n) / base));
}

const TENURE_BUCKETS: Array<{
  key: string;
  label: string;
  minMonths: number;
  maxMonths: number | null;
}> = [
  { key: "0-1y", label: "Under 1 year", minMonths: 0, maxMonths: 11 },
  { key: "1-3y", label: "1–3 years", minMonths: 12, maxMonths: 35 },
  { key: "3-5y", label: "3–5 years", minMonths: 36, maxMonths: 59 },
  { key: "5y+", label: "5+ years", minMonths: 60, maxMonths: null },
];

export async function getPayEquityReport(companyId: string) {
  const run = await prisma.payrollRun.findFirst({
    where: { companyId, status: { in: ["APPROVED", "PAID"] } },
    orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
    include: {
      payslips: {
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              department: true,
              jobTitle: true,
              sex: true,
              employmentType: true,
              startDate: true,
              basicSalaryKobo: true,
            },
          },
        },
      },
    },
  });

  if (!run || run.payslips.length === 0) {
    return {
      hasData: false as const,
      period: null,
      bySex: [] as EquityGroupRow[],
      byDepartment: [] as EquityGroupRow[],
      byJobTitle: [] as EquityGroupRow[],
      tenure: [] as TenurePayRow[],
      gaps: [] as EquityGapFlag[],
      headcount: 0,
    };
  }

  const asOf = new Date(run.periodYear, run.periodMonth - 1, 28);
  const people = run.payslips.map((p) => ({
    id: p.employee.id,
    code: p.employee.employeeCode,
    name: `${p.employee.firstName} ${p.employee.lastName}`,
    department: p.employee.department || "Unassigned",
    jobTitle: p.employee.jobTitle || "Unspecified",
    sex: p.employee.sex,
    employmentType: p.employee.employmentType,
    startDate: p.employee.startDate,
    gross: p.grossPayKobo,
    basic: p.basicSalaryKobo,
  }));

  const bySex = groupStats(
    people.map((p) => ({
      key: p.sex ?? "UNKNOWN",
      label: employeeSexLabel(p.sex),
      gross: p.gross,
      basic: p.basic,
    }))
  );

  const byDepartment = groupStats(
    people.map((p) => ({
      key: p.department,
      label: p.department,
      gross: p.gross,
      basic: p.basic,
    }))
  );

  const byJobTitle = groupStats(
    people.map((p) => ({
      key: p.jobTitle,
      label: p.jobTitle,
      gross: p.gross,
      basic: p.basic,
    }))
  );

  const tenure: TenurePayRow[] = TENURE_BUCKETS.map((bucket) => {
    const inBucket = people.filter((p) => {
      const months = differenceInMonths(asOf, p.startDate);
      if (months < bucket.minMonths) return false;
      if (bucket.maxMonths != null && months > bucket.maxMonths) return false;
      return true;
    });
    return {
      bucket: bucket.label,
      headcount: inBucket.length,
      meanGrossKobo: mean(inBucket.map((p) => p.gross)).toString(),
      meanBasicKobo: mean(inBucket.map((p) => p.basic)).toString(),
    };
  }).filter((t) => t.headcount > 0);

  const gaps: EquityGapFlag[] = [];

  // Overall gender gap (median gross)
  const male = bySex.find((r) => r.key === "MALE");
  const female = bySex.find((r) => r.key === "FEMALE");
  if (male && female && male.headcount >= 2 && female.headcount >= 2) {
    const pct = gapPct(
      BigInt(male.medianGrossKobo),
      BigInt(female.medianGrossKobo)
    );
    if (pct != null && pct >= 10) {
      const higher = BigInt(male.medianGrossKobo) > BigInt(female.medianGrossKobo)
        ? "Male"
        : "Female";
      gaps.push({
        id: "gender-median-gap",
        severity: pct >= 20 ? "watch" : "info",
        title: `Gender median pay gap ${pct}%`,
        detail: `${higher} median gross is higher (${formatCurrency(BigInt(male.medianGrossKobo))} male vs ${formatCurrency(BigInt(female.medianGrossKobo))} female). Review roles and bands — not proof of bias alone.`,
        gapPct: pct,
        href: "/employees",
      });
    }
  }

  // Same job title gender gap when both sexes present (n≥2 each)
  const jobSex = new Map<
    string,
    { male: bigint[]; female: bigint[]; title: string }
  >();
  for (const p of people) {
    if (p.sex !== "MALE" && p.sex !== "FEMALE") continue;
    const row = jobSex.get(p.jobTitle) ?? {
      male: [],
      female: [],
      title: p.jobTitle,
    };
    if (p.sex === "MALE") row.male.push(p.gross);
    else row.female.push(p.gross);
    jobSex.set(p.jobTitle, row);
  }

  for (const [title, row] of jobSex) {
    if (row.male.length < 2 || row.female.length < 2) continue;
    const mMed = median(
      [...row.male].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    );
    const fMed = median(
      [...row.female].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    );
    const pct = gapPct(mMed, fMed);
    if (pct == null || pct < 10) continue;
    gaps.push({
      id: `job-gap-${title}`,
      severity: pct >= 15 ? "watch" : "info",
      title: `${title}: ${pct}% gender pay gap`,
      detail: `Median gross ${formatCurrency(mMed)} (male, n=${row.male.length}) vs ${formatCurrency(fMed)} (female, n=${row.female.length}).`,
      gapPct: pct,
      href: "/employees",
    });
  }

  gaps.sort((a, b) => b.gapPct - a.gapPct);

  return {
    hasData: true as const,
    period: {
      month: run.periodMonth,
      year: run.periodYear,
      runId: run.id,
    },
    bySex,
    byDepartment: byDepartment.slice(0, 15),
    byJobTitle: byJobTitle.slice(0, 15),
    tenure,
    gaps: gaps.slice(0, 12),
    headcount: people.length,
  };
}
