"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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

interface ReportData {
  hasData: boolean;
  period?: { month: number; year: number };
  summary?: {
    totalGross: string;
    totalNet: string;
    totalPaye: string;
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

interface YtdEmployee {
  employeeCode: string;
  name: string;
  department: string;
  tin: string | null;
  monthsPaid: number;
  ytdGrossKobo: string;
  ytdPayeKobo: string;
  ytdNetKobo: string;
}

export default function ReportsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [ytdYear, setYtdYear] = useState(now.getFullYear());
  const [data, setData] = useState<ReportData | null>(null);
  const [ytdData, setYtdData] = useState<YtdEmployee[]>([]);
  const [loading, setLoading] = useState(false);

  const loadReports = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/reports/summary?month=${month}&year=${year}`).then((r) =>
        r.json()
      ),
      fetch(`/api/reports/ytd-earnings?year=${ytdYear}`).then((r) => r.json()),
    ]).then(([summary, ytd]) => {
      setData(summary);
      setYtdData(ytd.employees ?? []);
      setLoading(false);
    });
  }, [month, year, ytdYear]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const chartData =
    data?.byDepartment?.map((d) => ({
      name: d.department,
      gross: Number(d.gross) / 100,
    })) ?? [];

  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);
  const yearOptions = [year - 1, year, year + 1];

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Reports</h1>
          <p className="mt-1 text-sm text-stone-500">
            Payroll costs, remittances, and YTD earnings
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="month" className="text-xs text-stone-500">
              Period
            </Label>
            <div className="mt-1 flex gap-2">
              <select
                id="month"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-9 rounded-md border border-stone-300 px-2 text-sm"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 rounded-md border border-stone-300 px-2 text-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {data?.hasData && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/reports/remittances/export?month=${month}&year=${year}`}
                download
              >
                Export remittances CSV
              </a>
            </Button>
          )}
        </div>
      </div>

      {loading && !data ? (
        <p className="text-stone-500">Loading…</p>
      ) : !data?.hasData ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-500">
            No approved payroll data for {getMonthName(month)} {year}.
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
              <Card key={label as string}>
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

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
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

      <Card className="mt-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>YTD employee earnings</CardTitle>
            <p className="mt-1 text-sm text-stone-500">
              For annual tax filing / Form A support
            </p>
          </div>
          <div className="flex items-end gap-2">
            <select
              value={ytdYear}
              onChange={(e) => setYtdYear(Number(e.target.value))}
              className="h-9 rounded-md border border-stone-300 px-2 text-sm"
            >
              {[ytdYear - 1, ytdYear, ytdYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/reports/ytd-earnings?year=${ytdYear}&format=csv`}
                download
              >
                Export CSV
              </a>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>TIN</TableHead>
                <TableHead className="text-right">Months</TableHead>
                <TableHead className="text-right">YTD gross</TableHead>
                <TableHead className="text-right">YTD PAYE</TableHead>
                <TableHead className="text-right">YTD net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ytdData.map((emp) => (
                <TableRow key={emp.employeeCode}>
                  <TableCell>
                    <span className="font-medium">{emp.name}</span>
                    <span className="ml-2 text-xs text-stone-400">
                      {emp.employeeCode}
                    </span>
                  </TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell className="text-stone-500">
                    {emp.tin ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {emp.monthsPaid}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={emp.ytdGrossKobo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={emp.ytdPayeKobo} />
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={emp.ytdNetKobo} />
                  </TableCell>
                </TableRow>
              ))}
              {ytdData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-stone-500">
                    No approved payroll data for {ytdYear} yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
