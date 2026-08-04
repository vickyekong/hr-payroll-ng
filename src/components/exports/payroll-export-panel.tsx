"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ExportActions } from "@/components/exports/export-actions";
import { getMonthName } from "@/lib/utils";

interface PayrollRunOption {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
}

export function PayrollExportPanel({
  runs,
}: {
  runs: PayrollRunOption[];
}) {
  const [selectedRunId, setSelectedRunId] = useState(runs[0]?.id ?? "");
  const [driveConnected, setDriveConnected] = useState(false);

  useEffect(() => {
    if (!selectedRunId && runs[0]?.id) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    fetch("/api/integrations/google-drive")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.connected) setDriveConnected(true);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Export payroll</CardTitle>
        <p className="text-sm text-stone-500">
          Download a CSV, save it to Google Drive, or sync the payroll Sheet for
          the selected run.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {runs.length === 0 ? (
          <p className="text-sm text-stone-500">
            Create a payroll run first, then export it from here.
          </p>
        ) : (
          <>
            <div className="max-w-sm">
              <Label htmlFor="exportPayrollRun">Payroll run</Label>
              <select
                id="exportPayrollRun"
                className="mt-1 flex h-9 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900"
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {getMonthName(run.periodMonth)} {run.periodYear} ·{" "}
                    {run.status.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <ExportActions
              kind="payroll"
              runId={selectedRunId}
              driveConnected={driveConnected}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
