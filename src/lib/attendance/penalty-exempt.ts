/** Departments that never receive attendance (missed-shift) penalties. */
const EXEMPT_DEPARTMENT_PATTERN = /\bmanagement\b/i;

export function isAttendancePenaltyExempt(
  department: string | null | undefined
): boolean {
  if (!department) return false;
  return EXEMPT_DEPARTMENT_PATTERN.test(department.trim());
}
