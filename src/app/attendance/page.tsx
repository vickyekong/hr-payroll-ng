"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface ShiftRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  workDays: string;
  graceMinutes: number;
  _count: { assignments: number };
}

interface DayRow {
  id: string;
  workDate: string;
  status: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  lateMinutes: number;
  workedMinutes: number;
  penaltyKobo: string;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
    clockDeviceId: string | null;
  };
  shift: { name: string; startTime: string; endTime: string } | null;
}

interface PayrollRunOption {
  id: string;
  periodMonth: number;
  periodYear: number;
  status: string;
}

function statusVariant(
  status: string
): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "PRESENT":
      return "success";
    case "LATE":
    case "PARTIAL":
      return "warning";
    case "ABSENT":
      return "danger";
    case "ON_LEAVE":
      return "info";
    default:
      return "default";
  }
}

export default function AttendancePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    present: 0,
    late: 0,
    partial: 0,
    absent: 0,
    onLeave: 0,
    penaltyKobo: "0",
  });
  const [days, setDays] = useState<DayRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [unmappedPunches, setUnmappedPunches] = useState(0);
  const [employeesMissingDevice, setEmployeesMissingDevice] = useState(0);
  const [penaltyNaira, setPenaltyNaira] = useState(0);
  const [filterStatus, setFilterStatus] = useState("ABSENT");
  const [runs, setRuns] = useState<PayrollRunOption[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");

  const [shiftName, setShiftName] = useState("Standard day");
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({
      month: String(month),
      year: String(year),
      ...(filterStatus ? { status: filterStatus } : {}),
    });
    const [att, payrollRuns] = await Promise.all([
      fetch(`/api/attendance?${qs}`).then((r) => r.json()),
      fetch("/api/payroll/runs").then((r) => r.json()),
    ]);
    setSummary(att.summary ?? summary);
    setDays(att.days ?? []);
    setShifts(att.shifts ?? []);
    setUnmappedPunches(att.unmappedPunches ?? 0);
    setEmployeesMissingDevice(att.employeesMissingDevice ?? 0);
    setPenaltyNaira(Number(att.settings?.missedShiftPenaltyKobo ?? 0) / 100);
    const draftRuns = (payrollRuns as PayrollRunOption[]).filter(
      (r) => r.status === "DRAFT"
    );
    setRuns(draftRuns);
    if (!selectedRunId && draftRuns[0]) setSelectedRunId(draftRuns[0].id);
    setLoading(false);
  }, [month, year, filterStatus, selectedRunId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, filterStatus]);

  async function importFile(file: File) {
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/attendance/import", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Import failed");
      return;
    }
    alert(
      `Imported ${data.imported} punches (${data.mapped} mapped to staff, ${data.unmapped} unmapped).`
    );
    await load();
  }

  async function compile() {
    setLoading(true);
    const res = await fetch("/api/attendance/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, year }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Compile failed");
      return;
    }
    alert(
      `Compiled ${data.daysCompiled} day records. Missed shifts: ${data.absentCount}.`
    );
    await load();
  }

  async function saveSettings() {
    setLoading(true);
    const res = await fetch("/api/attendance/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missedShiftPenaltyNaira: penaltyNaira }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Failed to save settings");
      return;
    }
    alert(
      penaltyNaira > 0
        ? "Saved fixed missed-shift penalty."
        : "Saved. Penalty will use each staff member's daily basic rate."
    );
  }

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/attendance/shifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: shiftName,
        startTime: shiftStart,
        endTime: shiftEnd,
        workDays: "1111100",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Failed to create shift");
      return;
    }
    await load();
  }

  async function applyPenalties() {
    if (!selectedRunId) {
      alert("Select a draft payroll run first.");
      return;
    }
    if (
      !confirm(
        "Apply missed-shift penalties to this draft payroll run and recalculate?"
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/attendance/apply-penalties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payrollRunId: selectedRunId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      alert(data.error ?? "Failed to apply penalties");
      return;
    }
    alert(
      `Penalized ${data.employeesPenalized} staff for ${data.missedShiftDays} missed shifts.`
    );
  }

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-stone-900">Attendance</h1>
        <p className="mt-1 text-sm text-stone-500">
          Import clock-in machine punches, compile shifts, flag absences, and
          deduct from payroll
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Present", summary.present],
          ["Late", summary.late],
          ["Partial", summary.partial],
          ["Absent", summary.absent],
          ["On leave", summary.onLeave],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-lg border border-stone-200 bg-white px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wide text-stone-500">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1. Import clock machine data</CardTitle>
            <p className="text-sm text-stone-500">
              Upload CSV/TSV from your biometric device (ZKTeco-style: AcNo,
              DateTime, Status). Map each staff member&apos;s machine ID on their
              employee profile first.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".csv,.txt,.tsv"
              disabled={loading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-stone-500">
              {employeesMissingDevice} active staff missing clock device ID ·{" "}
              {unmappedPunches} unmapped punches this period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Shifts &amp; penalty rule</CardTitle>
            <p className="text-sm text-stone-500">
              Define expected hours. Missed scheduled shifts create penalties
              (fixed amount, or daily basic if 0).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={createShift} className="grid gap-2 sm:grid-cols-3">
              <div>
                <Label htmlFor="shiftName">Shift name</Label>
                <Input
                  id="shiftName"
                  className="mt-1"
                  value={shiftName}
                  onChange={(e) => setShiftName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shiftStart">Start</Label>
                <Input
                  id="shiftStart"
                  type="time"
                  className="mt-1"
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="shiftEnd">End</Label>
                <Input
                  id="shiftEnd"
                  type="time"
                  className="mt-1"
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                />
              </div>
              <div className="sm:col-span-3">
                <Button type="submit" variant="outline" disabled={loading}>
                  Add Mon–Fri shift
                </Button>
              </div>
            </form>
            {shifts.length > 0 && (
              <ul className="space-y-1 text-sm text-stone-700">
                {shifts.map((s) => (
                  <li key={s.id}>
                    {s.name}: {s.startTime}–{s.endTime} · {s._count.assignments}{" "}
                    staff
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
              <div>
                <Label htmlFor="penalty">
                  Missed-shift penalty (₦, 0 = daily basic)
                </Label>
                <Input
                  id="penalty"
                  type="number"
                  min={0}
                  className="mt-1 w-40"
                  value={penaltyNaira}
                  onChange={(e) => setPenaltyNaira(Number(e.target.value))}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => void saveSettings()}
              >
                Save rule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>3. Compile month &amp; apply to payroll</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Month</Label>
            <select
              className="mt-1 flex h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {getMonthName(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Year</Label>
            <Input
              type="number"
              className="mt-1 w-24"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <Button disabled={loading} onClick={() => void compile()}>
            Compile shifts
          </Button>
          <div>
            <Label>Draft payroll run</Label>
            <select
              className="mt-1 flex h-9 min-w-[12rem] rounded-md border border-stone-300 bg-white px-2 text-sm"
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
            >
              <option value="">Select…</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {getMonthName(r.periodMonth)} {r.periodYear}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="outline"
            disabled={loading || !selectedRunId}
            onClick={() => void applyPenalties()}
          >
            Deduct missed shifts
          </Button>
          <p className="w-full text-sm text-stone-500">
            Period penalty total:{" "}
            <span className="font-medium text-stone-800">
              {formatCurrency(BigInt(summary.penaltyKobo || "0"))}
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-stone-900">
          Attendance days
        </h2>
        <select
          className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="ABSENT">Absent (missed shifts)</option>
          <option value="LATE">Late</option>
          <option value="PARTIAL">Partial</option>
          <option value="PRESENT">Present</option>
          <option value="ON_LEAVE">On leave</option>
        </select>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Staff</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>In / Out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Penalty</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((day) => (
              <TableRow key={day.id}>
                <TableCell className="tabular-nums">
                  {day.workDate.slice(0, 10)}
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {day.employee.firstName} {day.employee.lastName}
                  </div>
                  <div className="text-xs text-stone-500">
                    {day.employee.employeeCode}
                    {day.employee.clockDeviceId
                      ? ` · device ${day.employee.clockDeviceId}`
                      : ""}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-stone-600">
                  {day.shift
                    ? `${day.shift.name} (${day.shift.startTime}–${day.shift.endTime})`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm tabular-nums text-stone-600">
                  {day.clockInAt
                    ? new Date(day.clockInAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                  {" / "}
                  {day.clockOutAt
                    ? new Date(day.clockOutAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(day.status)}>
                    {day.status.replace(/_/g, " ")}
                    {day.lateMinutes > 0 ? ` · ${day.lateMinutes}m late` : ""}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <TableCurrency value={BigInt(day.penaltyKobo || "0")} />
                </TableCell>
              </TableRow>
            ))}
            {days.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-500">
                  {loading
                    ? "Loading…"
                    : "No compiled days yet. Import punches, assign shifts, then compile."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
