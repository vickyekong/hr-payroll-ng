/** Count Mon–Fri days inclusive between two dates. */
export function countWorkingDaysBetween(start: Date, end: Date): number {
  const from = new Date(start);
  from.setHours(0, 0, 0, 0);
  const to = new Date(end);
  to.setHours(0, 0, 0, 0);

  if (from > to) return 0;

  let count = 0;
  const current = new Date(from);
  while (current <= to) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export function getPeriodOverlap(
  leaveStart: Date,
  leaveEnd: Date,
  periodStart: Date,
  periodEnd: Date
): { start: Date; end: Date } | null {
  const start = new Date(
    Math.max(leaveStart.getTime(), periodStart.getTime())
  );
  const end = new Date(Math.min(leaveEnd.getTime(), periodEnd.getTime()));
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (start > end) return null;
  return { start, end };
}

export function unpaidWorkingDaysInPeriod(
  leaveStart: Date,
  leaveEnd: Date,
  periodStart: Date,
  periodEnd: Date
): number {
  const overlap = getPeriodOverlap(
    leaveStart,
    leaveEnd,
    periodStart,
    periodEnd
  );
  if (!overlap) return 0;
  return countWorkingDaysBetween(overlap.start, overlap.end);
}

export interface LeaveRequestDates {
  startDate: Date;
  endDate: Date;
}

/** Sum unpaid working days from approved leave overlapping a payroll period. */
export function sumUnpaidLeaveDaysInPeriod(
  requests: LeaveRequestDates[],
  periodStart: Date,
  periodEnd: Date
): number {
  return requests.reduce(
    (total, req) =>
      total +
      unpaidWorkingDaysInPeriod(
        req.startDate,
        req.endDate,
        periodStart,
        periodEnd
      ),
    0
  );
}
