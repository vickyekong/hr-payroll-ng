"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ReportData {
  hasData: boolean;
  summary?: {
    totalGross: string;
    totalNet: string;
    totalPaye: string;
    totalPensionEmployee: string;
    totalPensionEmployer: string;
    totalNhf: string;
    totalNsitf: string;
    totalEmployerCost: string;
    headcount: number;
  };
  byDepartment?: Array<{ department: string; gross: string; count: number }>;
  remittances?: {
    paye: string;
    pensionEmployee: string;
    pensionEmployer: string;
    nhf: string;
    nsitf: string;
    deadlines: Record<string, string>;
  };
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();

  useEffect(() => {
    fetch(`/api/reports/summary?month=${month}&year=${year}`)
      .then((r) => r.json())
      .then(setData);
  }, [month, year]);

  const chartData =
    data?.byDepartment?.map((d) => ({
      name: d.department,
      gross: Number(d.gross) / 100,
    })) ?? [];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Reports</h1>
        <p className="mt-1 text-sm text-stone-500">
          Payroll costs and statutory remittances
        </p>
      </div>

      {!data?.hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-500">
            No approved payroll data for this month yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total gross", data.summary!.totalGross],
              ["Total net pay", data.summary!.totalNet],
              ["Employer cost", data.summary!.totalEmployerCost],
              ["Headcount", String(data.summary!.headcount)],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-semibold tabular-nums">
                    {label === "Headcount"
                      ? value
                      : formatCurrency(BigInt(value))}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Department breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(v) =>
                        new Intl.NumberFormat("en-NG", {
                          style: "currency",
                          currency: "NGN",
                        }).format(Number(v))
                      }
                    />
                    <Bar dataKey="gross" fill="#44403c" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Remittances due</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  ["PAYE (State IRS)", data.remittances!.paye],
                  ["Pension (employee)", data.remittances!.pensionEmployee],
                  ["Pension (employer)", data.remittances!.pensionEmployer],
                  ["NHF", data.remittances!.nhf],
                  ["NSITF", data.remittances!.nsitf],
                ].map(([label, amount]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-stone-500">{label}</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(BigInt(amount as string))}
                    </span>
                  </div>
                ))}
                <div className="border-t border-stone-100 pt-3 text-xs text-stone-400">
                  {Object.entries(data.remittances!.deadlines).map(([k, v]) => (
                    <p key={k}>
                      {k.toUpperCase()}: {v}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
