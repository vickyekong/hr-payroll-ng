"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import type { PreflightData } from "@/components/payroll/preflight-panel";
import { cn } from "@/lib/cn";

export interface WizardPayslip {
  id: string;
  grossPayKobo: string;
  payeKobo: string;
  netPayKobo: string;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    department: string;
  };
}

export interface WizardAdjustment {
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

export interface WizardRun {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
  payslips: WizardPayslip[];
  adjustments: WizardAdjustment[];
}

const STEPS = [
  {
    id: 1,
    title: "Aggregate & pre-flight",
    blurb: "Contracts, deductions, then confirm attendance",
  },
  {
    id: 2,
    title: "Anomaly guardrails",
    blurb: "Omni Co-Pilot flags risks before money moves",
  },
  {
    id: 3,
    title: "Executive summary",
    blurb: "Cost, variance, and who is on this run",
  },
  {
    id: 4,
    title: "Approve & distribute",
    blurb: "Seek Super Admin clearance, file, and pay",
  },
] as const;

function severityRank(s: string) {
  if (s === "block") return 0;
  if (s === "warn") return 1;
  return 2;
}

function severityBadge(s: string) {
  if (s === "block") return "High";
  if (s === "warn") return "Medium";
  return "Low";
}

function severityRowClass(s: string) {
  if (s === "block") return "bg-red-50/80";
  if (s === "warn") return "bg-amber-50/60";
  return "bg-stone-50/80";
}

export function PayrollWizard({
  run,
  preflight,
  preflightLoading,
  loading,
  canApprove,
  canSubmit,
  driveConnected,
  submitNotice,
  showAdjustForm,
  initialStep,
  onToggleAdjustForm,
  onRefreshPreflight,
  onRecalculate,
  onApplyPenalties,
  onAction,
  onReject,
  onAddAdjustment,
  onDeleteAdjustment,
  onDeleteAllAdjustments,
}: {
  run: WizardRun;
  preflight: PreflightData | null;
  preflightLoading: boolean;
  loading: boolean;
  canApprove: boolean;
  canSubmit: boolean;
  driveConnected: boolean;
  submitNotice: {
    reviewUrl: string;
    recipients: Array<{
      name: string;
      email: string;
    }>;
  } | null;
  showAdjustForm: boolean;
  initialStep?: number;
  onToggleAdjustForm: () => void;
  onRefreshPreflight: () => void;
  onRecalculate: () => void;
  onApplyPenalties: () => void;
  onAction: (action: string, extra?: { reason?: string }) => void;
  onReject?: () => void;
  onAddAdjustment: (e: React.FormEvent<HTMLFormElement>) => void;
  onDeleteAdjustment: (id: string) => void;
  onDeleteAllAdjustments: () => void;
}) {
  const isDraft = run.status === "DRAFT";
  const defaultStep =
    initialStep && initialStep >= 1 && initialStep <= 4
      ? initialStep
      : run.status === "APPROVED" || run.status === "PAID"
        ? 4
        : run.status === "UNDER_REVIEW"
          ? canApprove
            ? 4
            : 3
          : preflight && !preflight.canSubmit
            ? 2
            : 1;

  const [step, setStep] = useState(defaultStep);

  const attendanceImpact = useMemo(() => {
    const rows = run.adjustments.filter((a) => a.type === "ATTENDANCE_PENALTY");
    if (rows.length === 0) return null;
    let total = 0n;
    let missed = 0;
    for (const row of rows) {
      const amt = BigInt(row.amountKobo);
      total += amt < 0n ? -amt : amt;
      const m = row.description?.match(/Missed (\d+)/);
      if (m) missed += Number(m[1]);
    }
    return {
      employees: rows.length,
      missedShifts: missed,
      totalKobo: total.toString(),
    };
  }, [run.adjustments]);

  useEffect(() => {
    if (initialStep && initialStep >= 1 && initialStep <= 4) {
      setStep(initialStep);
    } else if (run.status === "UNDER_REVIEW" && canApprove) {
      setStep(4);
    }
  }, [initialStep, run.status, canApprove]);

  const totals = useMemo(
    () =>
      run.payslips.reduce(
        (acc, p) => ({
          gross: acc.gross + BigInt(p.grossPayKobo),
          paye: acc.paye + BigInt(p.payeKobo),
          net: acc.net + BigInt(p.netPayKobo),
        }),
        { gross: 0n, paye: 0n, net: 0n }
      ),
    [run.payslips]
  );

  const deptBreakdown = useMemo(() => {
    const map = new Map<string, { gross: bigint; net: bigint; count: number }>();
    for (const p of run.payslips) {
      const d = p.employee.department || "Unassigned";
      const cur = map.get(d) ?? { gross: 0n, net: 0n, count: 0 };
      cur.gross += BigInt(p.grossPayKobo);
      cur.net += BigInt(p.netPayKobo);
      cur.count += 1;
      map.set(d, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (a.net > b.net ? -1 : 1));
  }, [run.payslips]);

  const sortedExceptions = useMemo(() => {
    if (!preflight) return [];
    return [...preflight.exceptions].sort(
      (a, b) => severityRank(a.severity) - severityRank(b.severity)
    );
  }, [preflight]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-lagoon">
            Payroll execution wizard
          </p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {getMonthName(run.periodMonth)} {run.periodYear}
          </h1>
        </div>
        <Badge variant={payrollStatusVariant(run.status)}>
          {run.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <nav className="-mx-4 mb-8 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              "w-[min(72vw,16rem)] shrink-0 snap-start rounded-xl border px-3 py-3 text-left transition-all duration-200 ease-brand sm:w-auto",
              step === s.id
                ? "border-ink bg-ink text-foam shadow-soft"
                : "border-line bg-foam/90 text-ink-soft hover:border-lagoon/35 hover:bg-lagoon-mist/30"
            )}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">
              Step {s.id}
            </p>
            <p className="mt-1 text-sm font-semibold">{s.title}</p>
            <p
              className={cn(
                "mt-0.5 line-clamp-2 text-xs",
                step === s.id ? "text-lagoon-mist/70" : "text-muted"
              )}
            >
              {s.blurb}
            </p>
          </button>
        ))}
      </nav>

      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated data aggregation</CardTitle>
              <p className="text-sm text-stone-500">
                Salaries use contracts and unpaid leave. Clock attendance
                deductions are <strong>proposed only after HR confirms</strong>{" "}
                via “Review &amp; apply attendance” — they are not applied
                automatically.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {attendanceImpact && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p className="font-medium">Attendance deductions (HR confirmed)</p>
                  <p className="mt-1 text-amber-900/90">
                    {attendanceImpact.employees} staff ·{" "}
                    {attendanceImpact.missedShifts} missed shift
                    {attendanceImpact.missedShifts === 1 ? "" : "s"} ·{" "}
                    {formatCurrency(BigInt(attendanceImpact.totalKobo))} proposed
                    against salaries
                  </p>
                  <Link
                    href="/employees?tab=attendance"
                    className="mt-1 inline-block text-xs font-medium text-amber-900 underline"
                  >
                    Review clock report →
                  </Link>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
              {isDraft && (
                <>
                  <Button
                    onClick={onRecalculate}
                    variant="outline"
                    disabled={loading}
                  >
                    Recalculate payslips
                  </Button>
                  <Button
                    onClick={onApplyPenalties}
                    variant="outline"
                    disabled={loading}
                  >
                    Review &amp; apply attendance
                  </Button>
                  <Button
                    onClick={onToggleAdjustForm}
                    variant="outline"
                    disabled={loading}
                  >
                    {showAdjustForm ? "Hide adjustment" : "Add adjustment"}
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                disabled={preflightLoading}
                onClick={onRefreshPreflight}
              >
                Refresh pre-flight
              </Button>
              <Button onClick={() => setStep(2)}>Continue to guardrails →</Button>
              </div>
            </CardContent>
          </Card>

          {showAdjustForm && isDraft && (
            <Card>
              <CardHeader>
                <CardTitle>Add one-off adjustment</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={onAddAdjustment}
                  className="grid gap-4 sm:grid-cols-2"
                >
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
                    <Input
                      id="description"
                      name="description"
                      className="mt-1"
                    />
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Payslips"
              value={String(run.payslips.length)}
              hint={
                preflight?.vsPrior.headcountDelta != null &&
                preflight.vsPrior.headcountDelta !== 0
                  ? `${preflight.vsPrior.headcountDelta > 0 ? "+" : ""}${preflight.vsPrior.headcountDelta} vs prior`
                  : undefined
              }
            />
            <Stat
              label="Gross"
              value={formatCurrency(totals.gross)}
            />
            <Stat label="PAYE" value={formatCurrency(totals.paye)} />
            <Stat label="Net" value={formatCurrency(totals.net)} />
          </div>

          {run.adjustments.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle>Adjustments ({run.adjustments.length})</CardTitle>
                {isDraft && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
                    disabled={loading}
                    onClick={onDeleteAllAdjustments}
                  >
                    Remove all
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Description</TableHead>
                      {isDraft && <TableHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {run.adjustments.map((adj) => (
                      <TableRow key={adj.id}>
                        <TableCell>
                          {adj.employee.firstName} {adj.employee.lastName}
                        </TableCell>
                        <TableCell>{adj.type.replace(/_/g, " ")}</TableCell>
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
                              onClick={() => onDeleteAdjustment(adj.id)}
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
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anomaly &amp; risk detection</CardTitle>
              <p className="text-sm text-stone-500">
                Omni Co-Pilot guardrails — fix High blockers before seeking Super
                Admin approval
              </p>
            </CardHeader>
            <CardContent>
              {preflightLoading && !preflight ? (
                <p className="text-sm text-stone-500">Running checks…</p>
              ) : !preflight ? (
                <p className="text-sm text-stone-500">
                  Could not load pre-flight. Refresh from step 1.
                </p>
              ) : (
                <>
                  <p
                    className={cn(
                      "mb-4 text-sm font-medium",
                      preflight.canSubmit
                        ? "text-emerald-800"
                        : "text-red-800"
                    )}
                  >
                    {preflight.canSubmit
                      ? `Ready — ${preflight.warnings} warning(s), ${preflight.infos} info`
                      : `${preflight.blockers} high-severity blocker(s) must be fixed`}
                  </p>
                  {sortedExceptions.length === 0 ? (
                    <p className="text-sm text-stone-500">
                      No anomalies — figures look clean against the last paid
                      run.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border border-stone-200">
                      <table className="w-full min-w-[40rem] text-left text-sm">
                        <thead className="border-b border-stone-100 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                          <tr>
                            <th className="px-3 py-2 font-medium">Severity</th>
                            <th className="px-3 py-2 font-medium">Alert</th>
                            <th className="px-3 py-2 font-medium">Issue</th>
                            <th className="px-3 py-2 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedExceptions.map((ex) => (
                            <tr
                              key={ex.id}
                              className={cn(
                                "border-b border-stone-100",
                                severityRowClass(ex.severity)
                              )}
                            >
                              <td className="px-3 py-2 font-medium">
                                {severityBadge(ex.severity)}
                              </td>
                              <td className="px-3 py-2">{ex.title}</td>
                              <td className="px-3 py-2 text-stone-600">
                                {ex.detail}
                              </td>
                              <td className="px-3 py-2">
                                {ex.href ? (
                                  <Link
                                    href={ex.href}
                                    className="text-stone-800 underline-offset-2 hover:underline"
                                  >
                                    Review →
                                  </Link>
                                ) : (
                                  <span className="text-stone-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(3)}>Continue to summary →</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Executive summary</CardTitle>
              <p className="text-sm text-stone-500">
                Financial and headcount snapshot before clearance
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Stat label="Total gross" value={formatCurrency(totals.gross)} />
              <Stat label="Total PAYE" value={formatCurrency(totals.paye)} />
              <Stat label="Total net" value={formatCurrency(totals.net)} />
            </CardContent>
          </Card>

          {preflight?.vsPrior.periodLabel && (
            <Card>
              <CardHeader>
                <CardTitle>Vs prior period</CardTitle>
                <p className="text-sm text-stone-500">
                  Compared with {preflight.vsPrior.periodLabel}
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                <p>
                  Headcount delta:{" "}
                  <span className="font-medium tabular-nums">
                    {preflight.vsPrior.headcountDelta ?? "—"}
                  </span>
                </p>
                <p>
                  Net delta:{" "}
                  <span className="font-medium tabular-nums">
                    {preflight.vsPrior.netDeltaKobo != null
                      ? formatCurrency(BigInt(preflight.vsPrior.netDeltaKobo))
                      : "—"}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Department cost</CardTitle>
              <p className="text-sm text-stone-500">
                This run — side-by-side by department
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Headcount</TableHead>
                    <TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptBreakdown.map((d) => (
                    <TableRow key={d.name}>
                      <TableCell>{d.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.count}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(d.gross)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(d.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-stone-200 bg-white">
            <div className="border-b border-stone-100 px-4 py-3">
              <p className="text-sm font-semibold text-stone-900">
                Payslip register
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead />
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
                    <TableCell
                      colSpan={6}
                      className="text-center text-stone-500"
                    >
                      No payslips — recalculate in step 1
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(4)}>Continue to distribute →</Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          {run.status === "UNDER_REVIEW" && canApprove && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader>
                <CardTitle>Super Admin clearance</CardTitle>
                <p className="text-sm text-stone-600">
                  HR submitted this run. Approve to lock figures or send back.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => onAction("approve")} disabled={loading}>
                  Approve payroll
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (onReject) {
                      onReject();
                      return;
                    }
                    if (confirm("Send this payroll back to HR as draft?")) {
                      onAction("reject");
                    }
                  }}
                  disabled={loading}
                >
                  Send back to HR
                </Button>
              </CardContent>
            </Card>
          )}

          {isDraft && (
            <Card>
              <CardHeader>
                <CardTitle>Submit for Super Admin approval</CardTitle>
                <p className="text-sm text-stone-500">
                  OmniPeople notifies Super Admin with a review link. Figures
                  stay editable until they approve.
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    if (preflight && !preflight.canSubmit) {
                      alert(
                        "Fix pre-flight blockers (step 2) before submitting."
                      );
                      setStep(2);
                      return;
                    }
                    onAction("submit_review");
                  }}
                  disabled={loading || !canSubmit}
                >
                  Submit for Super Admin approval
                </Button>
                {!canSubmit && (
                  <p className="w-full text-sm text-stone-500">
                    Resolve High blockers in step 2, then return here.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {run.status === "UNDER_REVIEW" && !canApprove && (
            <p className="text-sm text-stone-500">
              Submitted — waiting for Super Admin to approve.
            </p>
          )}

          {submitNotice && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader>
                <CardTitle>Submitted for approval</CardTitle>
                <p className="text-sm text-stone-600">
                  Super Admin was notified to approve this payroll.
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
                        await navigator.clipboard.writeText(
                          submitNotice.reviewUrl
                        );
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
                      {r.name} ({r.email}) · notified in-app
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Distribution &amp; statutory filing</CardTitle>
              <p className="text-sm text-stone-500">
                Bank batch CSV, filing pack (PAYE / pension / NHF / NSITF), and
                Drive sync
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <ExportActions
                kind="payroll"
                runId={run.id}
                driveConnected={driveConnected}
              />
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/payroll/runs/${run.id}/filing-pack`} download>
                  Download filing pack (ZIP)
                </a>
              </Button>
              {run.status === "APPROVED" && (
                <Button onClick={() => onAction("mark_paid")} disabled={loading}>
                  Mark as paid
                </Button>
              )}
              {(run.status === "APPROVED" || run.status === "PAID") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (
                      confirm(
                        "Reverse this run? It will reset to draft and regenerate payslips."
                      )
                    ) {
                      onAction("reverse");
                    }
                  }}
                  disabled={loading}
                >
                  Reverse & re-run
                </Button>
              )}
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => setStep(3)}>
            ← Back to summary
          </Button>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-stone-900">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
