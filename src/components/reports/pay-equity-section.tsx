"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCurrency,
} from "@/components/ui/table";
import { formatCurrency, getMonthName } from "@/lib/utils";

interface EquityGroupRow {
  key: string;
  label: string;
  headcount: number;
  meanGrossKobo: string;
  medianGrossKobo: string;
  meanBasicKobo: string;
  medianBasicKobo: string;
}

interface EquityGapFlag {
  id: string;
  severity: string;
  title: string;
  detail: string;
  gapPct: number;
}

interface EquityReport {
  hasData: boolean;
  period: { month: number; year: number; runId: string } | null;
  bySex: EquityGroupRow[];
  byDepartment: EquityGroupRow[];
  tenure: Array<{
    bucket: string;
    headcount: number;
    meanGrossKobo: string;
    meanBasicKobo: string;
  }>;
  gaps: EquityGapFlag[];
  headcount: number;
}

function GroupTable({
  title,
  rows,
}: {
  title: string;
  rows: EquityGroupRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-stone-500">No data</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">Median gross</TableHead>
                <TableHead className="text-right">Mean gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.headcount}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={r.medianGrossKobo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={r.meanGrossKobo} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function PayEquitySection() {
  const [data, setData] = useState<EquityReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/equity")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <p className="mt-8 text-sm text-stone-500">Loading pay equity…</p>
    );
  }

  if (!data?.hasData || !data.period) {
    return (
      <Card className="mt-8">
        <CardContent className="py-8 text-center text-sm text-stone-500">
          Approve a payroll run to unlock pay equity analysis.
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="mt-10 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-stone-900">
          Compensation &amp; pay equity
        </h2>
        <p className="text-sm text-stone-500">
          Based on latest approved payroll (
          {getMonthName(data.period.month)} {data.period.year} · {data.headcount}{" "}
          payslips). Gaps ≥10% are flagged for review — not automatic proof of
          bias.
        </p>
      </div>

      {data.gaps.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50">
          <div className="border-b border-amber-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-stone-900">
              Equity flags
            </h3>
          </div>
          <ul className="divide-y divide-amber-100">
            {data.gaps.map((g) => (
              <li key={g.id} className="px-4 py-3">
                <p className="text-sm font-medium text-stone-900">
                  {g.title}
                  <span className="ml-2 text-xs text-stone-500">
                    {g.severity}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-stone-600">{g.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupTable title="By sex" rows={data.bySex} />
        <GroupTable title="By department" rows={data.byDepartment} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenure vs pay</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenure</TableHead>
                <TableHead className="text-right">n</TableHead>
                <TableHead className="text-right">Mean basic</TableHead>
                <TableHead className="text-right">Mean gross</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tenure.map((t) => (
                <TableRow key={t.bucket}>
                  <TableCell className="font-medium">{t.bucket}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.headcount}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(BigInt(t.meanBasicKobo))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(BigInt(t.meanGrossKobo))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
