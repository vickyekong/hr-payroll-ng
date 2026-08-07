"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, payrollStatusVariant } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollExportPanel } from "@/components/exports/payroll-export-panel";
import { getMonthName } from "@/lib/utils";

interface PayrollRun {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  createdBy: { name: string };
  _count: { payslips: number };
}

export default function PayrollPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/payroll/runs")
      .then((r) => r.json())
      .then(setRuns);
  }, []);

  async function createRun() {
    setCreating(true);
    const now = new Date();
    const res = await fetch("/api/payroll/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear(),
        applyAttendancePenalties: true,
      }),
    });
    setCreating(false);
    if (res.ok) {
      const run = await res.json();
      window.location.href = `/payroll/${run.id}`;
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to create run");
    }
  }

  return (
    <AppShell>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Payroll</h1>
          <p className="mt-1 text-sm text-stone-500">
            OmniPeople 4-step wizard — clock attendance feeds salaries, then
            guardrails, summary, and Super Admin clearance
          </p>
        </div>
        <Button onClick={createRun} disabled={creating}>
          {creating ? "Creating…" : "Start payroll wizard"}
        </Button>
      </div>

      <PayrollExportPanel runs={runs} />

      <div className="rounded-lg border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Payslips</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell>
                  <Link
                    href={`/payroll/${run.id}`}
                    className="font-medium hover:underline"
                  >
                    {getMonthName(run.periodMonth)} {run.periodYear}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={payrollStatusVariant(run.status)}>
                    {run.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>{run.createdBy.name}</TableCell>
                <TableCell>{run._count.payslips}</TableCell>
              </TableRow>
            ))}
            {runs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-stone-500">
                  No payroll runs yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
