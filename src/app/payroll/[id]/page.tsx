"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge, payrollStatusVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ExportActions } from "@/components/exports/export-actions";
import { can } from "@/lib/permissions";

interface PayslipRow {
  id: string;
  grossPayKobo: string;
  payeKobo: string;
  netPayKobo: string;
  bonusesKobo?: string;
  otherDeductionsKobo?: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: string;
  };
}

interface AdjustmentRow {
  id: string;
  type: string;
  amountKobo: string;
  description?: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeCode: string;
  };
}

interface PayrollRunDetail {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  payslips: PayslipRow[];
  adjustments: AdjustmentRow[];
}

export default function PayrollRunDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{
    reviewUrl: string;
    recipients: Array<{ name: string; email: string; role: string; emailSent: boolean }>;
  } | null>(null);

  const canApprove = session?.user?.role
    ? can(session.user.role, "approvePayroll")
    : false;

  function loadRun() {
    fetch(`/api/payroll/runs/${params.id}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load payroll run");
        setRun(data);
      })
      .catch((err) => {
        console.error(err);
        setRun(null);
        alert(err instanceof Error ? err.message : "Failed to load payroll run");
      });
  }

  useEffect(() => {
    loadRun();
    fetch("/api/integrations/google-drive")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.connected) setDriveConnected(true);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function doAction(action: string) {
    setLoading(true);
    const res = await fetch(`/api/payroll/runs/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Action failed");
      return;
    }

    if (action === "submit_review" && data.notification) {
      setSubmitNotice({
        reviewUrl: data.notification.reviewUrl,
        recipients: data.notification.recipients ?? [],
      });
    } else {
      setSubmitNotice(null);
    }

    loadRun();
  }

  async function recalculate() {
    setLoading(true);
    const res = await fetch(`/api/payroll/runs/${params.id}/recalculate`, {
      method: "POST",
    });
    setLoading(false);
    if (res.ok) loadRun();
    else {
      const data = await res.json();
      alert(data.error ?? "Recalculate failed");
    }
  }

  async function deleteAdjustment(adjustmentId: string) {
    if (!confirm("Remove this adjustment and recalculate?")) return;
    setLoading(true);
    const res = await fetch(
      `/api/payroll/runs/${params.id}/adjustments/${adjustmentId}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (res.ok) loadRun();
    else {
      const data = await res.json();
      alert(data.error ?? "Failed to delete adjustment");
    }
  }

  async function addAdjustment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    const res = await fetch(`/api/payroll/runs/${params.id}/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: form.get("employeeId"),
        type: form.get("type"),
        amount: Number(form.get("amount")),
        description: form.get("description") || undefined,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setShowAdjustForm(false);
      loadRun();
      (e.target as HTMLFormElement).reset();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add adjustment");
    }
  }

  if (!run) {
    return (
      <AppShell>
        <p className="text-stone-500">Loading…</p>
      </AppShell>
    );
  }

  const isDraft = run.status === "DRAFT";

  const totals = run.payslips.reduce(
    (acc, p) => ({
      gross: acc.gross + BigInt(p.grossPayKobo),
      paye: acc.paye + BigInt(p.payeKobo),
      net: acc.net + BigInt(p.netPayKobo),
    }),
    { gross: 0n, paye: 0n, net: 0n }
  );

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500">Payroll run</p>
          <h1 className="text-2xl font-semibold text-stone-900">
            {getMonthName(run.periodMonth)} {run.periodYear}
          </h1>
        </div>
        <Badge variant={payrollStatusVariant(run.status)}>
          {run.status.replace("_", " ")}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Export payroll</CardTitle>
          <p className="text-sm text-stone-500">
            Download CSV, save to Google Drive, or sync this run to Sheets.
          </p>
        </CardHeader>
        <CardContent>
          <ExportActions
            kind="payroll"
            runId={run.id}
            driveConnected={driveConnected}
          />
        </CardContent>
      </Card>

      {run.status === "UNDER_REVIEW" && canApprove && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Approval required</CardTitle>
            <p className="text-sm text-stone-600">
              HR submitted this payroll for your review. Approve to lock figures,
              or send it back to draft.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => doAction("approve")} disabled={loading}>
              Approve payroll
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Send this payroll back to HR as draft?")) {
                  doAction("reject");
                }
              }}
              disabled={loading}
            >
              Send back to HR
            </Button>
          </CardContent>
        </Card>
      )}

      {submitNotice && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle>Submitted for approval</CardTitle>
            <p className="text-sm text-stone-600">
              Accountant / GM were notified with a review link.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="reviewLink">Approval link</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                <Input
                  id="reviewLink"
                  readOnly
                  value={submitNotice.reviewUrl}
                  className="min-w-[16rem] flex-1 bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(submitNotice.reviewUrl);
                    alert("Approval link copied");
                  }}
                >
                  Copy link
                </Button>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-stone-700">
              {submitNotice.recipients.map((r) => (
                <li key={r.email}>
                  {r.name} ({r.email})
                  {r.role === "FINANCE"
                    ? " · Accountant"
                    : r.role === "SUPER_ADMIN"
                      ? " · GM / Super Admin"
                      : ` · ${r.role}`}
                  {r.emailSent ? " · email sent" : " · in-app only"}
                </li>
              ))}
              {submitNotice.recipients.length === 0 && (
                <li className="text-stone-500">
                  No Finance or Super Admin users found to notify.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {isDraft && (
          <>
            <Button onClick={recalculate} variant="outline" disabled={loading}>
              Recalculate all
            </Button>
            <Button
              onClick={() => setShowAdjustForm(!showAdjustForm)}
              variant="outline"
              disabled={loading}
            >
              Add adjustment
            </Button>
            <Button
              onClick={() => doAction("submit_review")}
              disabled={loading || run.payslips.length === 0}
            >
              Submit to accountant / GM
            </Button>
          </>
        )}
        {run.status === "UNDER_REVIEW" && !canApprove && (
          <p className="text-sm text-stone-500">
            Waiting for accountant or GM approval.
          </p>
        )}
        {run.status === "APPROVED" && (
          <Button onClick={() => doAction("mark_paid")} disabled={loading}>
            Mark as paid
          </Button>
        )}
        {(run.status === "APPROVED" || run.status === "PAID") && (
          <Button
            variant="outline"
            onClick={() => {
              if (
                confirm(
                  "Reverse this run? It will reset to draft and regenerate payslips from current employee data and adjustments."
                )
              ) {
                doAction("reverse");
              }
            }}
            disabled={loading}
          >
            Reverse & re-run
          </Button>
        )}
      </div>

      {showAdjustForm && isDraft && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add one-off adjustment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addAdjustment} className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="employeeId">Employee</Label>
                <select
                  id="employeeId"
                  name="employeeId"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  <option value="">Select employee</option>
                  {run.payslips.map((p) => (
                    <option key={p.employee.id} value={p.employee.id}>
                      {p.employee.firstName} {p.employee.lastName} (
                      {p.employee.employeeCode})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  required
                  className="mt-1 flex h-9 w-full rounded-md border border-stone-300 px-3 text-sm"
                >
                  <option value="BONUS">Bonus</option>
                  <option value="LOAN_DEDUCTION">Loan deduction</option>
                  <option value="ADVANCE">Salary advance</option>
                  <option value="UNPAID_LEAVE">Unpaid leave (manual)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  min={0.01}
                  step={0.01}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input id="description" name="description" className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={loading}>
                  Save & recalculate employee
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {run.adjustments.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Adjustments ({run.adjustments.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Description</TableHead>
                  {isDraft && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.adjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell>
                      {adj.employee.firstName} {adj.employee.lastName}
                    </TableCell>
                    <TableCell>{adj.type.replace("_", " ")}</TableCell>
                    <TableCell className="text-right">
                      <TableCurrency value={adj.amountKobo} />
                    </TableCell>
                    <TableCell className="text-stone-500">
                      {adj.description ?? "—"}
                    </TableCell>
                    {isDraft && (
                      <TableCell className="text-right">
                        <button
                          type="button"
                          onClick={() => deleteAdjustment(adj.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Total gross", totals.gross],
          ["Total PAYE", totals.paye],
          ["Total net pay", totals.net],
        ].map(([label, amount]) => (
          <div
            key={label as string}
            className="rounded-lg border border-stone-200 bg-white p-4"
          >
            <p className="text-xs uppercase tracking-wide text-stone-500">
              {label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {formatCurrency(amount as bigint)}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">PAYE</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.payslips.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <span className="font-medium">
                    {p.employee.firstName} {p.employee.lastName}
                  </span>
                  <span className="ml-2 text-xs text-stone-400">
                    {p.employee.employeeCode}
                  </span>
                </TableCell>
                <TableCell>{p.employee.department}</TableCell>
                <TableCell className="text-right">
                  <TableCurrency value={p.grossPayKobo} />
                </TableCell>
                <TableCell className="text-right">
                  <TableCurrency value={p.payeKobo} />
                </TableCell>
                <TableCell className="text-right">
                  <TableCurrency value={p.netPayKobo} />
                </TableCell>
                <TableCell className="text-right">
                  {(run.status === "APPROVED" || run.status === "PAID") && (
                    <a
                      href={`/api/payslips/${p.id}/pdf`}
                      className="text-sm text-stone-600 hover:text-stone-900"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      PDF
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {run.payslips.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-500">
                  No payslips — click Recalculate all to generate
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
