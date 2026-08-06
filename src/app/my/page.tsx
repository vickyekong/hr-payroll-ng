"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
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
import { getMonthName } from "@/lib/utils";
import Link from "next/link";
import { MyChangeRequestsPanel } from "@/components/my/change-requests-panel";

interface Payslip {
  id: string;
  grossPayKobo: string;
  netPayKobo: string;
  payrollRun: {
    periodMonth: number;
    periodYear: number;
    status: string;
  };
}

interface LeaveBalance {
  leaveType: string;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
}

export default function MyPortalPage() {
  const { data: session } = useSession();
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);

  useEffect(() => {
    fetch("/api/payslips/mine")
      .then((r) => r.json())
      .then(setPayslips);
    fetch("/api/leave/balances")
      .then((r) => r.json())
      .then(setBalances);
  }, []);

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">My Portal</h1>
        <p className="mt-1 text-sm text-stone-500">
          Welcome, {session?.user?.name}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Leave balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {balances.length === 0 ? (
              <p className="text-stone-500">No balance records yet.</p>
            ) : (
              balances.map((b) => (
                <div
                  key={b.leaveType}
                  className="flex justify-between border-b border-stone-100 pb-2 last:border-0"
                >
                  <span className="text-stone-500">
                    {b.leaveType.replace("_", " ")}
                  </span>
                  <span className="font-medium tabular-nums">
                    {b.remainingDays} / {b.entitledDays} days
                  </span>
                </div>
              ))
            )}
            <Link
              href="/leave"
              className="block pt-2 text-stone-600 hover:text-stone-900"
            >
              Request leave →
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>My payslips</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {getMonthName(p.payrollRun?.periodMonth ?? 1)}{" "}
                      {p.payrollRun?.periodYear}
                    </TableCell>
                    <TableCell className="text-right">
                      <TableCurrency value={p.grossPayKobo} />
                    </TableCell>
                    <TableCell className="text-right">
                      <TableCurrency value={p.netPayKobo} />
                    </TableCell>
                    <TableCell className="text-right">
                      <a
                        href={`/api/payslips/${p.id}/pdf`}
                        className="text-sm text-stone-600 hover:text-stone-900"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download PDF
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
                {payslips.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-stone-500">
                      No payslips available yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <MyChangeRequestsPanel />
    </AppShell>
  );
}
