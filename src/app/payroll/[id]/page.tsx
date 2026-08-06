"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";
import {
  PayrollWizard,
  type WizardRun,
} from "@/components/payroll/payroll-wizard";
import type { PreflightData } from "@/components/payroll/preflight-panel";
import { can } from "@/lib/permissions";

export default function PayrollRunDetailPage() {
  const params = useParams();
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
      emailSent: boolean;
    }>;
  } | null>(null);

  const canApprove = session?.user?.role
    ? can(session.user.role, "approvePayroll")
    : false;

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

  async function recalculate() {
    setLoading(true);
    const res = await fetch(`/api/payroll/runs/${params.id}/recalculate`, {
      method: "POST",
    });
    setLoading(false);
    if (res.ok) {
      loadRun();
      loadPreflight();
    } else {
      const data = await res.json();
      alert(data.error ?? "Recalculate failed");
    }
  }

  async function applyAttendancePenalties() {
    setLoading(true);
    const res = await fetch("/api/attendance/apply-penalties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollRunId: params.id }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Could not apply attendance penalties");
      return;
    }
    alert(
      data.employeesPenalized
        ? `Applied penalties for ${data.employeesPenalized} employee(s) (${data.missedShiftDays} missed shifts).`
        : "No attendance penalties for this period."
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

  return (
    <AppShell>
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
        onToggleAdjustForm={() => setShowAdjustForm((v) => !v)}
        onRefreshPreflight={loadPreflight}
        onRecalculate={recalculate}
        onApplyPenalties={applyAttendancePenalties}
        onAction={doAction}
        onAddAdjustment={addAdjustment}
        onDeleteAdjustment={deleteAdjustment}
      />
    </AppShell>
  );
}
