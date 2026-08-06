/** Departments not regulated by clock-in shifts (no late/absent scoring or penalties). */
const SHIFT_EXEMPT_DEPARTMENT_PATTERN = /\bmanagement\b/i;

export function isShiftAttendanceExempt(
  department: string | null | undefined
): boolean {
  if (!department) return false;
  return SHIFT_EXEMPT_DEPARTMENT_PATTERN.test(department.trim());
}

/** @deprecated Prefer isShiftAttendanceExempt — same rule for Management. */
export const isAttendancePenaltyExempt = isShiftAttendanceExempt;
