"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AttendanceReportCharts } from "@/components/employees/attendance-report-charts";
import { formatCurrency, getMonthName } from "@/lib/utils";

interface StaffSummaryRow {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  clockDeviceId: string | null;
  present: number;
  late: number;
  partial: number;
  absent: number;
  onLeave: number;
  scheduledDays: number;
  attendanceRate: number | null;
  penaltyKobo: string;
}

interface DayRow {
  id: string;
  workDate: string;
  status: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  lateMinutes: number;
  penaltyKobo: string;
  employee: {
    employeeCode: string;
    firstName: string;
    lastName: string;
    department: string;
  };
  shift: { name: string; startTime: string; endTime: string } | null;
}

interface ChartSlice {
  key: string;
  name: string;
  value: number;
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

function clampReportYear(value: number, fallback = new Date().getFullYear()) {
  const max = new Date().getFullYear() + 1;
  if (!Number.isFinite(value) || value < 2020 || value > max) return fallback;
  return Math.trunc(value);
}

function clampReportMonth(value: number, fallback = new Date().getMonth() + 1) {
  if (!Number.isFinite(value) || value < 1 || value > 12) return fallback;
  return Math.trunc(value);
}

function formatApiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const err = (data as { error?: unknown }).error;
  if (typeof err === "string" && err.trim()) return err;
  if (Array.isArray(err)) {
    return err
      .map((item) =>
        item && typeof item === "object" && "message" in item
          ? String((item as { message: unknown }).message)
          : null
      )
      .filter(Boolean)
      .join("; ") || fallback;
  }
  return fallback;
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d` (weekStartsOn = 1). */
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return mon;
}

function sundayOfMonday(monday: Date): Date {
  return new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6
  );
}

function formatWeekLabel(weekOfIso: string): string {
  const [y, m, d] = weekOfIso.split("-").map(Number);
  const monday = mondayOf(new Date(y, m - 1, d));
  const sunday = sundayOfMonday(monday);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function EmployeesAttendanceTab() {
  const now = new Date();
  const fileRef = useRef<HTMLInputElement>(null);
  const [periodMode, setPeriodMode] = useState<"month" | "week">("month");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [weekOf, setWeekOf] = useState(toLocalIso(mondayOf(now)));
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"ok" | "err">("ok");
  const [periodLabel, setPeriodLabel] = useState("");
  const [summary, setSummary] = useState({
    present: 0,
    late: 0,
    partial: 0,
    absent: 0,
    onLeave: 0,
    penaltyKobo: "0",
  });
  const [charts, setCharts] = useState<{
    byStatus: ChartSlice[];
    byStaffOutcome: ChartSlice[];
    byDepartmentAbsent: ChartSlice[];
  }>({ byStatus: [], byStaffOutcome: [], byDepartmentAbsent: [] });
  const [staffSummary, setStaffSummary] = useState<StaffSummaryRow[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [unmappedPunches, setUnmappedPunches] = useState(0);
  const [employeesMissingDevice, setEmployeesMissingDevice] = useState(0);
  const [shiftsCount, setShiftsCount] = useState(0);
  const [detailFilter, setDetailFilter] = useState("ABSENT");
  const [shiftName, setShiftName] = useState("Standard day");
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");

  const loadReport = useCallback(
    async (opts?: {
      mode?: "month" | "week";
      month?: number;
      year?: number;
      weekOf?: string;
      filter?: string;
    }) => {
      const mode = opts?.mode ?? periodMode;
      const m = opts?.month ?? month;
      const y = opts?.year ?? year;
      const w = opts?.weekOf ?? weekOf;
      const filter = opts?.filter ?? detailFilter;

      setLoading(true);
      setPhase("Loading report…");
      const qs = new URLSearchParams({
        ...(filter ? { status: filter } : {}),
      });
      if (mode === "week") {
        qs.set("weekOf", w);
      } else {
        qs.set("month", String(m));
        qs.set("year", String(y));
      }
      const res = await fetch(`/api/attendance?${qs}`);
      const data = await res.json();
      setLoading(false);
      setPhase("");
      if (!res.ok) {
        setMessageTone("err");
        setMessage(data.error ?? "Failed to load attendance");
        return;
      }
      setSummary(data.summary ?? summary);
      setCharts(
        data.charts ?? {
          byStatus: [],
          byStaffOutcome: [],
          byDepartmentAbsent: [],
        }
      );
      setStaffSummary(data.staffSummary ?? []);
      setDays(data.days ?? []);
      setUnmappedPunches(data.unmappedPunches ?? 0);
      setEmployeesMissingDevice(data.employeesMissingDevice ?? 0);
      setShiftsCount(data.shifts?.length ?? 0);
      if (data.period?.mode === "week" && data.period.from && data.period.to) {
        setPeriodLabel(`${data.period.from} → ${data.period.to}`);
      } else {
        setPeriodLabel(`${getMonthName(m)} ${y}`);
      }
    },
    [periodMode, month, year, weekOf, detailFilter]
  );

  useEffect(() => {
    setYear((y) => clampReportYear(y));
  }, []);

  useEffect(() => {
    void loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodMode, month, year, weekOf, detailFilter]);

  async function analyseMonth(m: number, y: number) {
    const safeMonth = clampReportMonth(m, month);
    const safeYear = clampReportYear(
      y,
      year < 2020 ? new Date().getFullYear() : year
    );
    if (safeMonth !== month) setMonth(safeMonth);
    if (safeYear !== year) setYear(safeYear);

    setPhase("Analysing punches into daily attendance…");
    const compileRes = await fetch("/api/attendance/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: safeMonth, year: safeYear }),
    });
    const compileData = await compileRes.json();
    if (!compileRes.ok) {
      throw new Error(formatApiError(compileData, "Analysis failed"));
    }
    return {
      ...(compileData as {
        daysCompiled: number;
        staffCompiled?: number;
        absentCount: number;
        punchesUsed?: number;
        penaltyTotalKobo: string;
        period?: { from: string; to: string };
      }),
      month: safeMonth,
      year: safeYear,
    };
  }

  async function analyseWeek(weekIso: string) {
    const [y, m, d] = weekIso.split("-").map(Number);
    const monday = mondayOf(new Date(y, m - 1, d));
    const iso = toLocalIso(monday);
    if (iso !== weekOf) setWeekOf(iso);

    setPhase("Analysing weekly attendance…");
    const compileRes = await fetch("/api/attendance/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekOf: iso }),
    });
    const compileData = await compileRes.json();
    if (!compileRes.ok) {
      throw new Error(formatApiError(compileData, "Weekly analysis failed"));
    }
    return {
      ...(compileData as {
        daysCompiled: number;
        staffCompiled?: number;
        absentCount: number;
        punchesUsed?: number;
        penaltyTotalKobo: string;
        period?: { from: string; to: string };
      }),
      weekOf: iso,
    };
  }

  async function uploadAndAnalyse(file: File) {
    setLoading(true);
    setMessage("");
    setMessageTone("ok");
    try {
      setPhase("Importing clock punches from file…");
      const form = new FormData();
      form.append("file", file);
      const importRes = await fetch("/api/attendance/import", {
        method: "POST",
        body: form,
      });
      const importData = await importRes.json();
      if (!importRes.ok) {
        throw new Error(
          importData.error ??
            (importData.parseErrors?.length
              ? importData.parseErrors.join("; ")
              : "Import failed")
        );
      }

      const targetMonth = clampReportMonth(
        importData.periodHint?.month ?? month,
        month
      );
      const targetYear = clampReportYear(
        importData.periodHint?.year ?? year,
        year
      );
      if (targetMonth !== month || targetYear !== year) {
        setMonth(targetMonth);
        setYear(targetYear);
      }
      setPeriodMode("month");

      const compileData = await analyseMonth(targetMonth, targetYear);

      const linked =
        importData.autoLinkedDeviceIds?.length > 0
          ? ` Auto-linked ${importData.autoLinkedDeviceIds.length} clock IDs to staff codes.`
          : "";

      setMessageTone("ok");
      setMessage(
        `Imported ${importData.imported} punches (${importData.mapped} matched, ${importData.unmapped} unmatched). ` +
          `Report for ${getMonthName(targetMonth)} ${targetYear}: ${compileData.daysCompiled} day records · ${compileData.absentCount} missed shifts · ${compileData.staffCompiled ?? "—"} staff scored.${linked}`
      );
      setDetailFilter("ABSENT");
      await loadReport({
        mode: "month",
        month: targetMonth,
        year: targetYear,
        filter: "ABSENT",
      });
    } catch (err) {
      setMessageTone("err");
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setLoading(false);
      setPhase("");
    }
  }

  async function reanalyse() {
    setLoading(true);
    setMessage("");
    setMessageTone("ok");
    try {
      if (periodMode === "week") {
        const compileData = await analyseWeek(weekOf);
        setMessageTone("ok");
        setMessage(
          `Weekly report ${formatWeekLabel(compileData.weekOf)}: ${compileData.daysCompiled} day records · ${compileData.absentCount} missed shifts · ${compileData.punchesUsed ?? 0} punches used.`
        );
        await loadReport({ mode: "week", weekOf: compileData.weekOf });
      } else {
        const compileData = await analyseMonth(month, year);
        setMessageTone("ok");
        setMessage(
          `Re-analysed ${getMonthName(compileData.month)} ${compileData.year}: ${compileData.daysCompiled} day records · ${compileData.absentCount} missed shifts · ${compileData.punchesUsed ?? 0} punches used.`
        );
        await loadReport({
          mode: "month",
          month: compileData.month,
          year: compileData.year,
        });
      }
    } catch (err) {
      setMessageTone("err");
      setMessage(err instanceof Error ? err.message : "Analyse failed");
      setLoading(false);
      setPhase("");
    }
  }

  async function analyseWeekOnly() {
    setPeriodMode("week");
    setLoading(true);
    setMessage("");
    setMessageTone("ok");
    try {
      const compileData = await analyseWeek(weekOf);
      setMessageTone("ok");
      setMessage(
        `Weekly report ${formatWeekLabel(compileData.weekOf)}: ${compileData.daysCompiled} day records · ${compileData.absentCount} missed shifts · ${compileData.punchesUsed ?? 0} punches used.`
      );
      setDetailFilter("ABSENT");
      await loadReport({
        mode: "week",
        weekOf: compileData.weekOf,
        filter: "ABSENT",
      });
    } catch (err) {
      setMessageTone("err");
      setMessage(err instanceof Error ? err.message : "Weekly analysis failed");
      setLoading(false);
      setPhase("");
    }
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
      setMessageTone("err");
      setMessage(data.error ?? "Could not create shift");
      return;
    }
    setMessageTone("ok");
    setMessage(
      `Shift “${data.name}” created. Upload a clock file or click Analyse month — staff without a shift are assigned automatically.`
    );
    await loadReport();
  }

  function exportStaffReport() {
    const stamp =
      periodMode === "week"
        ? `week-${weekOf}`
        : `${year}-${String(month).padStart(2, "0")}`;
    downloadCsv(
      `attendance-staff-${stamp}.csv`,
      [
        "employee_code",
        "name",
        "department",
        "clock_device_id",
        "present",
        "late",
        "partial",
        "absent",
        "on_leave",
        "scheduled_days",
        "attendance_rate_pct",
        "penalty_naira",
      ],
      staffSummary.map((r) => [
        r.employeeCode,
        r.name,
        r.department,
        r.clockDeviceId ?? "",
        String(r.present),
        String(r.late),
        String(r.partial),
        String(r.absent),
        String(r.onLeave),
        String(r.scheduledDays),
        r.attendanceRate == null ? "" : String(r.attendanceRate),
        (Number(r.penaltyKobo || "0") / 100).toFixed(2),
      ])
    );
  }

  function exportDailyReport() {
    const stamp =
      periodMode === "week"
        ? `week-${weekOf}`
        : `${year}-${String(month).padStart(2, "0")}`;
    downloadCsv(
      `attendance-daily-${stamp}.csv`,
      [
        "date",
        "employee_code",
        "name",
        "department",
        "status",
        "clock_in",
        "clock_out",
        "late_minutes",
        "penalty_naira",
      ],
      days.map((d) => [
        d.workDate.slice(0, 10),
        d.employee.employeeCode,
        `${d.employee.firstName} ${d.employee.lastName}`,
        d.employee.department,
        d.status,
        d.clockInAt ? new Date(d.clockInAt).toISOString() : "",
        d.clockOutAt ? new Date(d.clockOutAt).toISOString() : "",
        String(d.lateMinutes),
        (Number(d.penaltyKobo || "0") / 100).toFixed(2),
      ])
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-stone-900">
          Clock machine · import & report
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          Upload a CSV, PDF, or Excel export from the biometric clock. OmniPeople
          matches badge IDs to staff (including <code className="text-xs">STAFF-001</code>{" "}
          ↔ device <code className="text-xs">1</code>), scores each day against
          the default shift, and builds the attendance report below.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label>Period</Label>
            <select
              className="mt-1 flex h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
              value={periodMode}
              onChange={(e) =>
                setPeriodMode(e.target.value === "week" ? "week" : "month")
              }
            >
              <option value="month">Month</option>
              <option value="week">Week (Mon–Sun)</option>
            </select>
          </div>
          {periodMode === "month" ? (
            <>
              <div>
                <Label>Report month</Label>
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
                  min={2020}
                  max={new Date().getFullYear() + 1}
                  value={year}
                  onChange={(e) =>
                    setYear(clampReportYear(Number(e.target.value), year))
                  }
                />
              </div>
            </>
          ) : (
            <div>
              <Label>Week of (any day in the week)</Label>
              <Input
                type="date"
                className="mt-1 w-[11rem]"
                value={weekOf}
                min="2020-01-01"
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  const [y, m, d] = v.split("-").map(Number);
                  setWeekOf(toLocalIso(mondayOf(new Date(y, m - 1, d))));
                }}
              />
              <p className="mt-1 text-[11px] text-stone-500">
                {formatWeekLabel(weekOf)}
              </p>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,.tsv,.pdf,.xlsx,.xls,text/csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            disabled={loading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAndAnalyse(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
          >
            {loading ? phase || "Working…" : "Import file & analyse"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void reanalyse()}
          >
            {periodMode === "week" ? "Analyse week" : "Analyse month"}
          </Button>
          {periodMode === "month" && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => void analyseWeekOnly()}
            >
              Analyse this week
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={loading || staffSummary.length === 0}
            onClick={exportStaffReport}
          >
            Export staff CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || days.length === 0}
            onClick={exportDailyReport}
          >
            Export daily CSV
          </Button>
        </div>

        <p className="mt-3 text-xs text-stone-500">
          Matching uses each staff member&apos;s clock machine ID when set, or
          the number in their staff code.{" "}
          {employeesMissingDevice > 0 && (
            <>{employeesMissingDevice} active staff have no saved clock ID yet (auto-link runs on import). </>
          )}
          {unmappedPunches > 0 && (
            <>{unmappedPunches} punches this month are still unmatched. </>
          )}
        </p>

        {shiftsCount === 0 && (
          <form
            onSubmit={createShift}
            className="mt-4 grid gap-2 rounded-md border border-dashed border-stone-300 bg-stone-50 p-3 sm:grid-cols-4"
          >
            <div className="sm:col-span-4 text-sm text-stone-600">
              Optional: create a named shift. If none exists, import creates
              “Standard day” (08:00–17:00, Mon–Fri) automatically.
            </div>
            <Input
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              placeholder="Shift name"
            />
            <Input
              type="time"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
            <Input
              type="time"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
            <Button type="submit" disabled={loading}>
              Add shift
            </Button>
          </form>
        )}

        {message && (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-sm ${
              messageTone === "err"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-900"
            }`}
          >
            {message}
          </p>
        )}
        {loading && phase && (
          <p className="mt-2 text-sm text-stone-500">{phase}</p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Present days", summary.present],
          ["Late", summary.late],
          ["Partial", summary.partial],
          ["Missed shifts", summary.absent],
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

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-stone-900">
              Attendance analysis
            </h3>
            <p className="text-sm text-stone-500">
              {periodLabel ||
                (periodMode === "week"
                  ? formatWeekLabel(weekOf)
                  : `${getMonthName(month)} ${year}`)}{" "}
              · penalty total{" "}
              {formatCurrency(BigInt(summary.penaltyKobo || "0"))}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Management departments are not shift-regulated (no late/absent
              scoring).
            </p>
          </div>
        </div>
        <AttendanceReportCharts
          byStatus={charts.byStatus}
          byStaffOutcome={charts.byStaffOutcome}
          byDepartmentAbsent={charts.byDepartmentAbsent}
        />
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-stone-900">
          Staff attendance summary
        </h3>
        <div className="rounded-lg border border-stone-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Late</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Leave</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Penalty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffSummary.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-stone-500">
                      {row.employeeCode}
                      {row.clockDeviceId ? ` · device ${row.clockDeviceId}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>{row.department}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.present}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.late + row.partial}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-red-700">
                    {row.absent}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.onLeave}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.attendanceRate == null
                      ? "—"
                      : `${row.attendanceRate}%`}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableCurrency value={BigInt(row.penaltyKobo || "0")} />
                  </TableCell>
                </TableRow>
              ))}
              {staffSummary.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-stone-500">
                    {loading
                      ? "Working…"
                      : "Import a clock-machine file to generate the staff attendance report."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-stone-900">
            Daily attendance detail
          </h3>
          <select
            className="h-9 rounded-md border border-stone-300 bg-white px-2 text-sm"
            value={detailFilter}
            onChange={(e) => setDetailFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ABSENT">Missed shifts</option>
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
                      {day.employee.employeeCode} · {day.employee.department}
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
                      {day.lateMinutes > 0 ? ` · ${day.lateMinutes}m` : ""}
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
                    No daily rows for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
