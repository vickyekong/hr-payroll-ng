"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import {
  PayrollWizard,
  type WizardRun,
} from "@/components/payroll/payroll-wizard";
import { PayrollClearanceBar } from "@/components/payroll/payroll-clearance-bar";
import type { PreflightData } from "@/components/payroll/preflight-panel";
import { can } from "@/lib/permissions";

function PayrollRunDetailInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const [run, setRun] = useState<WizardRun | null>(null);
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{
    reviewUrl: string;
    recipients: Array<{
      name: string;
      email: string;
    }>;
  } | null>(null);

  const canApprove = session?.user?.role
    ? can(session.user.role, "approvePayroll")
    : false;

  const stepParam = Number(searchParams.get("step") ?? "");
  const initialStep =
    stepParam >= 1 && stepParam <= 4 ? stepParam : undefined;

  const loadPreflight = useCallback(() => {
    if (!params.id) return;
    setPreflightLoading(true);
    fetch(`/api/payroll/runs/${params.id}/preflight`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Pre-flight failed");
        setPreflight(data);
      })
      .catch(() => setPreflight(null))
      .finally(() => setPreflightLoading(false));
  }, [params.id]);

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
    loadPreflight();
    fetch("/api/integrations/google-drive")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.connected) setDriveConnected(true);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function doAction(action: string, extra?: { reason?: string }) {
    setLoading(true);
    const res = await fetch(`/api/payroll/runs/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: extra?.reason }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      if (data.preflight) setPreflight(data.preflight);
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
    loadPreflight();
  }

  function rejectWithReason() {
    const reason = window.prompt(
      "Optional note for HR (why this run is being sent back):",
      ""
    );
    if (reason === null) return;
    void doAction("reject", { reason: reason.trim() || undefined });
  }

  async function recalculate() {
    setLoading(true);
    const res = await fetch(`/api/payroll/runs/${params.id}/recalculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncAttendance: false }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      loadRun();
      loadPreflight();
    } else {
      alert(data.error ?? "Recalculate failed");
    }
  }

  async function applyAttendancePenalties() {
    const ok = confirm(
      "Compile this month’s clock attendance and apply missed-shift deductions to draft payslips?\n\nAdmin/Finance remain pay-exempt. This only runs after you confirm."
    );
    if (!ok) return;

    setLoading(true);
    const res = await fetch("/api/attendance/apply-penalties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollRunId: params.id }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Could not sync attendance into pay");
      return;
    }
    const totalNaira = data.penaltyTotalKobo
      ? (Number(data.penaltyTotalKobo) / 100).toLocaleString("en-NG", {
          style: "currency",
          currency: "NGN",
        })
      : null;
    alert(
      data.employeesPenalized
        ? `Synced clock attendance into salaries.\n${data.missedShiftDays} missed shift(s) · ${data.employeesPenalized} staff · ${totalNaira ?? ""} deducted.`
        : `Attendance compiled (${data.daysCompiled ?? 0} day records). No missed-shift deductions for this period.`
    );
    loadRun();
    loadPreflight();
  }

  async function deleteAdjustment(adjustmentId: string) {
    if (!confirm("Remove this adjustment and recalculate?")) return;
    setLoading(true);
    const res = await fetch(
      `/api/payroll/runs/${params.id}/adjustments/${adjustmentId}`,
      { method: "DELETE" }
    );
    setLoading(false);
    if (res.ok) {
      loadRun();
      loadPreflight();
    } else {
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
      loadPreflight();
      (e.target as HTMLFormElement).reset();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to add adjustment");
    }
  }

  if (!run) {
    return (
      <AppShell>
        <p className="text-stone-500">Loading payroll wizard…</p>
      </AppShell>
    );
  }

  const isDraft = run.status === "DRAFT";
  const canSubmit =
    isDraft &&
    run.payslips.length > 0 &&
    (preflight?.canSubmit ?? false);

  const showClearance = run.status === "UNDER_REVIEW" && canApprove;

  return (
    <AppShell>
      {showClearance && (
        <PayrollClearanceBar
          periodMonth={run.periodMonth}
          periodYear={run.periodYear}
          loading={loading}
          onApprove={() => void doAction("approve")}
          onReject={rejectWithReason}
        />
      )}
      <PayrollWizard
        run={run}
        preflight={preflight}
        preflightLoading={preflightLoading}
        loading={loading}
        canApprove={canApprove}
        canSubmit={canSubmit}
        driveConnected={driveConnected}
        submitNotice={submitNotice}
        showAdjustForm={showAdjustForm}
        initialStep={initialStep}
        onToggleAdjustForm={() => setShowAdjustForm((v) => !v)}
        onRefreshPreflight={loadPreflight}
        onRecalculate={recalculate}
        onApplyPenalties={applyAttendancePenalties}
        onAction={doAction}
        onReject={rejectWithReason}
        onAddAdjustment={addAdjustment}
        onDeleteAdjustment={deleteAdjustment}
      />
    </AppShell>
  );
}

export default function PayrollRunDetailPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <p className="text-stone-500">Loading payroll wizard…</p>
        </AppShell>
      }
    >
      <PayrollRunDetailInner />
    </Suspense>
  );
}
