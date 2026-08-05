export type RiskKind =
  | "burnout"
  | "attrition"
  | "leave_spike"
  | "dept_pressure";

function daysBetween(later: Date, earlier: Date): number {
  const ms = later.getTime() - earlier.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export interface RiskSignal {
  id: string;
  kind: RiskKind;
  severity: "critical" | "watch" | "info";
  title: string;
  detail: string;
  href?: string;
  metric?: string;
  department?: string;
}

export function percentChange(current: number, prior: number): number | null {
  if (prior <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - prior) / prior) * 100);
}

export interface DeptMonthStats {
  department: string;
  headcount: number;
  absentDays: number;
  lateDays: number;
  scheduledDays: number;
}

/** Burnout / pressure heuristic: absences + late days rising MoM in a dept. */
export function detectDepartmentPressure(
  current: DeptMonthStats[],
  prior: DeptMonthStats[],
  options?: { absenceSpikePct?: number; minAbsentDays?: number }
): RiskSignal[] {
  const spikePct = options?.absenceSpikePct ?? 40;
  const minAbsent = options?.minAbsentDays ?? 3;
  const priorMap = new Map(prior.map((d) => [d.department, d]));
  const signals: RiskSignal[] = [];

  for (const cur of current) {
    if (cur.headcount === 0) continue;
    const prev = priorMap.get(cur.department);
    const pressureScore = cur.absentDays * 2 + cur.lateDays;
    const priorPressure = prev
      ? prev.absentDays * 2 + prev.lateDays
      : 0;

    const absentDelta = percentChange(cur.absentDays, prev?.absentDays ?? 0);
    const lateDelta = percentChange(cur.lateDays, prev?.lateDays ?? 0);

    const absencesSpiked =
      cur.absentDays >= minAbsent &&
      absentDelta != null &&
      absentDelta >= spikePct;
    const latesSpiked =
      cur.lateDays >= minAbsent &&
      lateDelta != null &&
      lateDelta >= spikePct;
    const highLoad =
      cur.scheduledDays > 0 &&
      (cur.absentDays + cur.lateDays) / cur.scheduledDays >= 0.2 &&
      pressureScore >= priorPressure + 3;

    if (!absencesSpiked && !latesSpiked && !highLoad) continue;

    const parts: string[] = [];
    if (absentDelta != null && cur.absentDays > 0) {
      parts.push(
        `missed shifts ${absentDelta >= 0 ? "+" : ""}${absentDelta}% (${prev?.absentDays ?? 0} → ${cur.absentDays})`
      );
    }
    if (lateDelta != null && cur.lateDays > 0) {
      parts.push(
        `late/partial ${lateDelta >= 0 ? "+" : ""}${lateDelta}% (${prev?.lateDays ?? 0} → ${cur.lateDays})`
      );
    }

    const severity =
      (absentDelta != null && absentDelta >= 80) ||
      (cur.absentDays >= 8 && cur.headcount <= 10)
        ? "critical"
        : "watch";

    signals.push({
      id: `dept-pressure-${cur.department}`,
      kind: highLoad || latesSpiked ? "burnout" : "dept_pressure",
      severity,
      title: `${cur.department}: workforce pressure rising`,
      detail:
        parts.length > 0
          ? `${parts.join("; ")}. Review workload, staffing, and overtime culture.`
          : `Elevated absences/lates vs headcount (${cur.headcount}). Risk of burnout is elevated.`,
      href: "/employees?tab=attendance",
      metric:
        absentDelta != null
          ? `${absentDelta >= 0 ? "+" : ""}${absentDelta}%`
          : undefined,
      department: cur.department,
    });
  }

  return signals;
}

export function detectLeaveSpike(
  currentLeaveCount: number,
  priorLeaveCount: number,
  options?: { spikePct?: number; minCurrent?: number }
): RiskSignal | null {
  const spikePct = options?.spikePct ?? 50;
  const minCurrent = options?.minCurrent ?? 3;
  if (currentLeaveCount < minCurrent) return null;
  const delta = percentChange(currentLeaveCount, priorLeaveCount);
  if (delta == null || delta < spikePct) return null;

  return {
    id: "leave-spike",
    kind: "leave_spike",
    severity: delta >= 100 ? "critical" : "watch",
    title: `Leave requests up ${delta}% vs last month`,
    detail: `${priorLeaveCount} → ${currentLeaveCount} approved/pending leave items overlapping this month. Sudden spikes can signal burnout or attrition risk.`,
    href: "/leave",
    metric: `+${delta}%`,
  };
}

export interface NewHireAttendance {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  startDate: Date;
  absentDays: number;
  lateDays: number;
  scheduledDays: number;
}

/** New joiners (<90 days) with poor attendance → early attrition risk. */
export function detectEarlyAttritionRisk(
  hires: NewHireAttendance[],
  asOf: Date = new Date(),
  options?: { maxTenureDays?: number; maxAttendanceRate?: number }
): RiskSignal[] {
  const maxTenure = options?.maxTenureDays ?? 90;
  const maxRate = options?.maxAttendanceRate ?? 80;
  const signals: RiskSignal[] = [];

  for (const h of hires) {
    const tenureDays = daysBetween(asOf, h.startDate);
    if (tenureDays < 0 || tenureDays > maxTenure) continue;
    if (h.scheduledDays < 5) continue;

    const worked = h.scheduledDays - h.absentDays;
    const rate = Math.round((Math.max(0, worked) / h.scheduledDays) * 100);
    if (rate >= maxRate && h.absentDays < 3) continue;

    signals.push({
      id: `attrition-${h.employeeId}`,
      kind: "attrition",
      severity: rate < 60 || h.absentDays >= 5 ? "critical" : "watch",
      title: `Early attrition risk: ${h.name}`,
      detail: `${h.employeeCode} · ${h.department} · ${tenureDays} days tenure · ${rate}% attendance (${h.absentDays} missed, ${h.lateDays} late). Check onboarding and manager support.`,
      href: `/employees/${h.employeeId}`,
      metric: `${rate}%`,
      department: h.department,
    });
  }

  return signals;
}

export function riskSignalsToInsights(signals: RiskSignal[]): Array<{
  id: string;
  severity: "critical" | "watch" | "info" | "good";
  title: string;
  detail: string;
  href?: string;
  metric?: string;
}> {
  return signals.map((s) => ({
    id: s.id,
    severity: s.severity,
    title: s.title,
    detail: s.detail,
    href: s.href,
    metric: s.metric,
  }));
}
